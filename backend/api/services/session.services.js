const prisma = require('../../config/prisma');
const crypto = require('crypto');

const SESSION_TTL_DAYS = 30;
const SESSION_TTL_MS = SESSION_TTL_DAYS * 24 * 60 * 60 * 1000;
const EXTEND_THRESHOLD_MS = 10 * 24 * 60 * 60 * 1000; // Refresh when less than 10 days remain

// ======================== SESSION GENERATION ========================

const generateSessionId = () => crypto.randomBytes(32).toString('hex');

const buildSessionExpiry = () => new Date(Date.now() + SESSION_TTL_MS);

const createGuestSession = async () => {
  // Retry very defensively in the unlikely event of ID collision.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const sessionId = generateSessionId();
    try {
      return await prisma.guestSession.create({
        data: {
          sessionId,
          expiresAt: buildSessionExpiry(),
        },
      });
    } catch (error) {
      if (error?.code !== 'P2002' || attempt === 2) {
        throw error;
      }
    }
  }

  throw new Error('Failed to create guest session');
};

/**
 * Get or create a guest session.
 *
 * Behavior:
 * - Missing sessionId: create new.
 * - Unknown sessionId: create new random sessionId (do not trust client-provided unknown IDs).
 * - Expired sessionId: rotate to a new random sessionId on the same row to preserve related guest data.
 * - Near-expiry session: extend expiry (sliding TTL).
 */
const getOrCreateSession = async (sessionId) => {
  if (!sessionId) {
    return createGuestSession();
  }

  const now = Date.now();
  let session = await prisma.guestSession.findUnique({
    where: { sessionId },
  });

  if (!session) {
    return createGuestSession();
  }

  if (session.expiresAt.getTime() <= now) {
    session = await prisma.guestSession.update({
      where: { id: session.id },
      data: {
        sessionId: generateSessionId(),
        expiresAt: buildSessionExpiry(),
      },
    });
    return session;
  }

  if (session.expiresAt.getTime() - now <= EXTEND_THRESHOLD_MS) {
    session = await prisma.guestSession.update({
      where: { id: session.id },
      data: { expiresAt: buildSessionExpiry() },
    });
  }

  return session;
};

const validateSession = async (sessionId) => {
  if (!sessionId) return false;

  const session = await prisma.guestSession.findUnique({
    where: { sessionId },
  });

  if (!session) return false;
  return session.expiresAt >= new Date();
};

const extendSession = async (sessionId) => {
  return prisma.guestSession.update({
    where: { sessionId },
    data: { expiresAt: buildSessionExpiry() },
  });
};

// ======================== SESSION MIGRATION ========================

/**
 * Migrate guest session data to an authenticated user.
 * - Merge ACTIVE cart items into user's ACTIVE cart.
 * - Merge wishlist items into user's wishlist.
 * - Attach guest orders to user account.
 * - Delete the guest session and dependent guest entities.
 */
const migrateSessionToUser = async (sessionId, userId) => {
  const session = await prisma.guestSession.findUnique({
    where: { sessionId },
    include: {
      carts: {
        where: { status: 'ACTIVE' },
        include: {
          items: true,
        },
      },
      wishlists: {
        include: {
          items: true,
        },
      },
      orders: {
        where: { userId: null },
        select: { id: true },
      },
    },
  });

  if (!session) {
    throw new Error('Session not found');
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });

  if (!user) {
    throw new Error('User not found');
  }

  return prisma.$transaction(async (tx) => {
    let cartItemsMerged = 0;
    let cartItemsSkipped = 0;
    let wishlistItemsMerged = 0;

    let userCart = await tx.cart.findFirst({
      where: { userId, status: 'ACTIVE' },
    });

    if (!userCart) {
      userCart = await tx.cart.create({
        data: {
          userId,
          status: 'ACTIVE',
        },
      });
    }

    const guestCart = session.carts[0] || null;
    if (guestCart) {
      for (const guestItem of guestCart.items) {
        const variant = await tx.productVariant.findUnique({
          where: { id: guestItem.variantId },
          include: { inventory: true },
        });

        if (!variant || !variant.isAvailable || !variant.inventory) {
          cartItemsSkipped += 1;
          continue;
        }

        const maxAllowed = Math.max(0, variant.inventory.quantity);
        if (maxAllowed === 0) {
          cartItemsSkipped += 1;
          continue;
        }

        const existing = await tx.cartItem.findFirst({
          where: {
            cartId: userCart.id,
            variantId: guestItem.variantId,
            productId: guestItem.productId,
          },
        });

        if (existing) {
          const nextQuantity = Math.min(existing.quantity + guestItem.quantity, maxAllowed);
          if (nextQuantity !== existing.quantity) {
            await tx.cartItem.update({
              where: { id: existing.id },
              data: {
                quantity: nextQuantity,
                unitPrice: guestItem.unitPrice,
              },
            });
            cartItemsMerged += 1;
          } else {
            cartItemsSkipped += 1;
          }
        } else {
          const quantity = Math.min(guestItem.quantity, maxAllowed);
          if (quantity <= 0) {
            cartItemsSkipped += 1;
            continue;
          }

          await tx.cartItem.create({
            data: {
              cartId: userCart.id,
              productId: guestItem.productId,
              variantId: guestItem.variantId,
              quantity,
              unitPrice: guestItem.unitPrice,
            },
          });
          cartItemsMerged += 1;
        }
      }
    }

    let userWishlist = await tx.wishlist.findFirst({
      where: { userId },
    });

    if (!userWishlist) {
      userWishlist = await tx.wishlist.create({
        data: { userId },
      });
    }

    const guestWishlist = session.wishlists[0] || null;
    if (guestWishlist) {
      for (const guestItem of guestWishlist.items) {
        const existing = await tx.wishlistItem.findFirst({
          where: {
            wishlistId: userWishlist.id,
            productId: guestItem.productId,
            variantId: guestItem.variantId,
          },
        });

        if (existing) {
          continue;
        }

        await tx.wishlistItem.create({
          data: {
            wishlistId: userWishlist.id,
            productId: guestItem.productId,
            variantId: guestItem.variantId,
          },
        });
        wishlistItemsMerged += 1;
      }
    }

    const movedOrders = await tx.order.updateMany({
      where: {
        sessionId: session.id,
        userId: null,
      },
      data: {
        userId,
        sessionId: null,
      },
    });

    await tx.cart.deleteMany({
      where: { sessionId: session.id },
    });

    await tx.wishlist.deleteMany({
      where: { sessionId: session.id },
    });

    await tx.guestSession.delete({
      where: { id: session.id },
    });

    return {
      cartItemsMerged,
      cartItemsSkipped,
      wishlistItemsMerged,
      ordersLinked: movedOrders.count,
      migrated: true,
    };
  });
};

// ======================== SESSION CLEANUP ========================

const cleanupExpiredSessions = async () => {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - SESSION_TTL_MS);

  const deletedSessions = await prisma.guestSession.deleteMany({
    where: {
      OR: [
        { expiresAt: { lt: now } },
        {
          updatedAt: { lt: thirtyDaysAgo },
          carts: { none: {} },
          wishlists: { none: {} },
          orders: { none: {} },
        },
      ],
    },
  });

  const deletedAbandonedCarts = await prisma.cart.deleteMany({
    where: {
      status: 'ABANDONED',
      updatedAt: { lt: thirtyDaysAgo },
    },
  });

  const deletedOrphanGuestCarts = await prisma.cart.deleteMany({
    where: {
      userId: null,
      sessionId: null,
    },
  });

  const deletedOrphanWishlists = await prisma.wishlist.deleteMany({
    where: {
      userId: null,
      sessionId: null,
    },
  });

  return {
    sessionsDeleted: deletedSessions.count,
    cartsDeleted: deletedAbandonedCarts.count,
    orphanGuestCartsDeleted: deletedOrphanGuestCarts.count,
    orphanWishlistsDeleted: deletedOrphanWishlists.count,
  };
};

module.exports = {
  generateSessionId,
  getOrCreateSession,
  validateSession,
  extendSession,
  migrateSessionToUser,
  cleanupExpiredSessions,
};
