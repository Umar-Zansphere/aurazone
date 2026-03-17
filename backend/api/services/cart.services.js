const prisma = require('../../config/prisma');
const MAX_VARIANT_QUANTITY = 5;
const BULK_ORDER_MESSAGE = 'Please contact store for bulk orders';

const createCartError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const assertValidCartQuantity = (quantity) => {
  const parsed = Number(quantity);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw createCartError('Quantity must be greater than 0');
  }

  if (parsed > MAX_VARIANT_QUANTITY) {
    throw createCartError(`Maximum quantity per variant is ${MAX_VARIANT_QUANTITY}. ${BULK_ORDER_MESSAGE}`);
  }

  return parsed;
};

const getAvailableInventory = (inventory) => {
  if (!inventory) {
    return 0;
  }

  return Math.max(0, Number(inventory.quantity) - Number(inventory.reserved || 0));
};

// ======================== HELPER FUNCTIONS ========================

/**
 * Get guest session by sessionId (from cookie/header)
 * Middleware ensures session exists before calling service
 */
const getGuestSessionId = async (sessionId) => {
  if (!sessionId) return null;

  const session = await prisma.guestSession.findUnique({
    where: { sessionId }
  });

  return session?.id || null;
};

// ======================== CART MANAGEMENT ========================

const getActiveCart = async (userId = null, sessionId = null) => {
  if (!userId && !sessionId) {
    throw new Error('Either userId or sessionId must be provided');
  }

  let guestSessionId = null;

  // 1️⃣ Get guest session DB ID from sessionId
  if (!userId && sessionId) {
    guestSessionId = await getGuestSessionId(sessionId);
    if (!guestSessionId) {
      throw new Error('Invalid session');
    }
  }

  // 2️⃣ Build where clause
  const whereClause = {
    status: 'ACTIVE',
    ...(userId ? { userId } : { sessionId: guestSessionId }),
  };

  // 3️⃣ Try to fetch existing cart
  let cart = await prisma.cart.findFirst({
    where: whereClause,
    include: {
      items: {
        include: {
          product: {
            select: {
              id: true,
              name: true,
              brand: true,
              category: true,
              gender: true,
            },
          },
          variant: {
            select: {
              id: true,
              size: true,
              color: true,
              price: true,
              compareAtPrice: true,
              isAvailable: true,
              inventory: true,
              images: {
                where: { isPrimary: true },
                select: { url: true, altText: true },
              },
            },
          },
        },
      },
    },
  });

  // 4️⃣ Create cart if missing
  if (!cart) {
    cart = await prisma.cart.create({
      data: {
        status: 'ACTIVE',
        ...(userId ? { userId } : { sessionId: guestSessionId }),
      },
      include: {
        items: {
          include: {
            product: true,
            variant: {
              include: {
                inventory: true,
                images: { where: { isPrimary: true } },
              },
            },
          },
        },
      },
    });
  }

  return cart;
};


const addToCart = async (userId = null, sessionId = null, variantId, quantity = 1) => {
  const requestedQuantity = assertValidCartQuantity(quantity);

  // Validate variant exists and is available
  const variant = await prisma.productVariant.findUnique({
    where: { id: variantId },
    include: { product: true, inventory: true }
  });

  if (!variant) {
    throw createCartError('Variant not found', 404);
  }

  if (!variant.isAvailable) {
    throw createCartError('Variant is out of stock');
  }

  // Check inventory
  const available = getAvailableInventory(variant.inventory);

  if (available <= 0) {
    throw createCartError('Variant is out of stock');
  }

  if (available < requestedQuantity) {
    throw createCartError('Insufficient inventory');
  }

  let guestSessionId = null;
  if (!userId && sessionId) {
    guestSessionId = await getGuestSessionId(sessionId);
    if (!guestSessionId) {
      throw new Error('Invalid session');
    }
  }

  // Get or create active cart
  const whereClause = { status: 'ACTIVE' };
  if (userId) {
    whereClause.userId = userId;
  } else if (sessionId) {
    whereClause.sessionId = guestSessionId;
  } else {
    throw new Error('Either userId or sessionId must be provided');
  }

  let cart = await prisma.cart.findFirst({ where: whereClause });
  if (!cart) {
    const cartData = { status: 'ACTIVE' };
    if (userId) {
      cartData.userId = userId;
    } else {
      cartData.sessionId = guestSessionId;
    }
    cart = await prisma.cart.create({ data: cartData });
  }

  // Check if item already in cart
  let cartItem = await prisma.cartItem.findFirst({
    where: {
      cartId: cart.id,
      variantId,
      productId: variant.productId
    }
  });

  if (cartItem) {
    // Update quantity
    const newQuantity = cartItem.quantity + requestedQuantity;

    if (newQuantity > MAX_VARIANT_QUANTITY) {
      throw createCartError(`Maximum quantity per variant is ${MAX_VARIANT_QUANTITY}. ${BULK_ORDER_MESSAGE}`);
    }

    if (available < newQuantity) {
      throw createCartError('Insufficient inventory for this quantity');
    }

    cartItem = await prisma.cartItem.update({
      where: { id: cartItem.id },
      data: { quantity: newQuantity },
      include: {
        product: true,
        variant: {
          include: {
            inventory: true,
            images: { where: { isPrimary: true } }
          }
        }
      }
    });
  } else {
    // Create new cart item
    cartItem = await prisma.cartItem.create({
      data: {
        cartId: cart.id,
        productId: variant.productId,
        variantId,
        quantity: requestedQuantity,
        unitPrice: variant.price
      },
      include: {
        product: true,
        variant: {
          include: {
            inventory: true,
            images: { where: { isPrimary: true } }
          }
        }
      }
    });
  }

  return {
    message: requestedQuantity > 1 ? `Updated quantity to ${cartItem.quantity}` : 'Added to cart',
    cartItem
  };
};

const updateCartItem = async (userId = null, sessionId = null, cartItemId, quantity) => {
  const nextQuantity = assertValidCartQuantity(quantity);

  // Ensure guest session exists if sessionId provided
  let guestSessionId = null;
  if (!userId && sessionId) {
    guestSessionId = await getGuestSessionId(sessionId);
    if (!guestSessionId) {
      throw new Error('Invalid session');
    }
  }

  // Build where clause
  const whereClause = { id: cartItemId };
  const cartWhere = {};

  if (userId) {
    cartWhere.userId = userId;
  } else if (sessionId) {
    cartWhere.sessionId = guestSessionId;
  } else {
    throw new Error('Either userId or sessionId must be provided');
  }

  // Verify item belongs to user's or guest's cart
  const cartItem = await prisma.cartItem.findFirst({
    where: {
      id: cartItemId,
      cart: cartWhere
    },
    include: { variant: { include: { inventory: true } } }
  });

  if (!cartItem) {
    throw createCartError('Cart item not found', 404);
  }

  if (!cartItem.variant.isAvailable) {
    throw createCartError('Variant is out of stock');
  }

  // Check inventory
  const available = getAvailableInventory(cartItem.variant.inventory);

  if (available <= 0) {
    throw createCartError('Variant is out of stock');
  }

  if (available < nextQuantity) {
    throw createCartError('Insufficient inventory');
  }

  const updatedItem = await prisma.cartItem.update({
    where: { id: cartItemId },
    data: { quantity: nextQuantity },
    include: {
      product: true,
      variant: {
        include: {
          inventory: true,
          images: { where: { isPrimary: true } }
        }
      }
    }
  });

  return {
    message: 'Cart item updated',
    cartItem: updatedItem
  };
};

const removeFromCart = async (userId = null, sessionId = null, cartItemId) => {
  // Ensure guest session exists if sessionId provided
  let guestSessionId = null;
  if (!userId && sessionId) {
    guestSessionId = await getGuestSessionId(sessionId);
    if (!guestSessionId) {
      throw new Error('Invalid session');
    }
  } else if (!userId && !sessionId) {
    throw new Error('Either userId or sessionId must be provided');
  }

  // Build where clause
  const cartWhere = {};
  if (userId) {
    cartWhere.userId = userId;
  } else {
    cartWhere.sessionId = guestSessionId;
  }

  // Verify item belongs to user's or guest's cart
  const cartItem = await prisma.cartItem.findFirst({
    where: {
      id: cartItemId,
      cart: cartWhere
    }
  });

  if (!cartItem) {
    throw new Error('Cart item not found');
  }

  await prisma.cartItem.delete({
    where: { id: cartItemId }
  });

  return { message: 'Item removed from cart' };
};

const clearCart = async (userId = null, sessionId = null) => {
  // Ensure guest session exists if sessionId provided
  let guestSessionId = null;
  if (!userId && sessionId) {
    guestSessionId = await getGuestSessionId(sessionId);
    if (!guestSessionId) {
      throw new Error('Invalid session');
    }
  }

  const whereClause = { status: 'ACTIVE' };
  if (userId) {
    whereClause.userId = userId;
  } else if (sessionId) {
    whereClause.sessionId = guestSessionId;
  } else {
    throw new Error('Either userId or sessionId must be provided');
  }

  const cart = await prisma.cart.findFirst({ where: whereClause });

  if (!cart) {
    throw new Error('Cart not found');
  }

  await prisma.cartItem.deleteMany({
    where: { cartId: cart.id }
  });

  return { message: 'Cart cleared' };
};

const getCartSummary = async (userId = null, sessionId = null) => {
  const cart = await getActiveCart(userId, sessionId);

  let subtotal = 0;
  const items = cart.items.map(item => {
    const itemTotal = parseFloat(item.variant.price) * item.quantity;
    subtotal += itemTotal;

    return {
      id: item.id,
      product: item.product,
      variant: item.variant,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      itemTotal: itemTotal
    };
  });

  return {
    cartId: cart.id,
    items,
    itemCount: items.length,
    subtotal: parseFloat(subtotal.toFixed(2)),
    tax: parseFloat((subtotal * 0.18).toFixed(2)), // Assuming 18% tax
    total: parseFloat((subtotal + subtotal * 0.18).toFixed(2)),
    createdAt: cart.createdAt,
    updatedAt: cart.updatedAt
  };
};

// ======================== WISHLIST MANAGEMENT ========================

const getWishlist = async (userId = null, sessionId = null) => {
  // Ensure guest session exists if sessionId provided
  let guestSessionId = null;
  if (!userId && sessionId) {
    guestSessionId = await getGuestSessionId(sessionId);
    if (!guestSessionId) {
      throw new Error('Invalid session');
    }
  }

  const whereClause = {};
  if (userId) {
    whereClause.userId = userId;
  } else if (sessionId) {
    whereClause.sessionId = guestSessionId;
  } else {
    throw new Error('Either userId or sessionId must be provided');
  }

  let wishlist = await prisma.wishlist.findFirst({
    where: whereClause,
    include: {
      items: {
        include: {
          product: {
            select: {
              id: true,
              name: true,
              brand: true,
              category: true,
              gender: true,
              isActive: true,
              isFeatured: true
            }
          },
          variant: {
            select: {
              id: true,
              size: true,
              color: true,
              price: true,
              compareAtPrice: true,
              isAvailable: true,
              images: {
                where: { isPrimary: true },
                select: { url: true, altText: true }
              }
            }
          }
        }
      }
    }
  });

  // Create wishlist if doesn't exist
  if (!wishlist) {
    const wishlistData = {};
    if (userId) {
      wishlistData.userId = userId;
    } else {
      wishlistData.sessionId = guestSessionId;
    }

    wishlist = await prisma.wishlist.create({
      data: wishlistData,
      include: { items: { include: { product: true, variant: true } } }
    });
  }

  return wishlist;
};

const addToWishlist = async (userId = null, sessionId = null, productId, variantId = null) => {
  // Validate product exists
  const product = await prisma.product.findUnique({
    where: { id: productId }
  });

  if (!product) {
    throw new Error('Product not found');
  }

  // If variantId provided, validate it
  if (variantId) {
    const variant = await prisma.productVariant.findUnique({
      where: { id: variantId }
    });

    if (!variant || variant.productId !== productId) {
      throw new Error('Variant not found or does not belong to this product');
    }
  }

  // Ensure guest session exists if sessionId provided
  let guestSessionId = null;
  if (!userId && sessionId) {
    guestSessionId = await getGuestSessionId(sessionId);
    if (!guestSessionId) {
      throw new Error('Invalid session');
    }
  }

  // Get or create wishlist
  const whereClause = {};
  if (userId) {
    whereClause.userId = userId;
  } else if (sessionId) {
    whereClause.sessionId = guestSessionId;
  } else {
    throw new Error('Either userId or sessionId must be provided');
  }

  let wishlist = await prisma.wishlist.findFirst({ where: whereClause });

  if (!wishlist) {
    const wishlistData = {};
    if (userId) {
      wishlistData.userId = userId;
    } else {
      wishlistData.sessionId = guestSessionId;
    }
    wishlist = await prisma.wishlist.create({ data: wishlistData });
  }

  // Check if item already in wishlist
  const existingItem = await prisma.wishlistItem.findFirst({
    where: {
      wishlistId: wishlist.id,
      productId,
      variantId: variantId || null
    }
  });

  if (existingItem) {
    throw new Error('Item already in wishlist');
  }

  const wishlistItem = await prisma.wishlistItem.create({
    data: {
      wishlistId: wishlist.id,
      productId,
      variantId: variantId || null
    },
    include: {
      product: {
        select: {
          id: true,
          name: true,
          brand: true,
          category: true,
          gender: true
        }
      },
      variant: {
        select: {
          id: true,
          size: true,
          color: true,
          price: true,
          compareAtPrice: true,
          isAvailable: true,
          images: { where: { isPrimary: true } }
        }
      }
    }
  });

  return {
    message: 'Added to wishlist',
    wishlistItem
  };
};

const removeFromWishlist = async (userId = null, sessionId = null, wishlistItemId) => {
  // Ensure guest session exists if sessionId provided
  let guestSessionId = null;
  if (!userId && sessionId) {
    guestSessionId = await getGuestSessionId(sessionId);
    if (!guestSessionId) {
      throw new Error('Invalid session');
    }
  }

  const wishlistWhere = {};
  if (userId) {
    wishlistWhere.userId = userId;
  } else if (sessionId) {
    wishlistWhere.sessionId = guestSessionId;
  } else {
    throw new Error('Either userId or sessionId must be provided');
  }

  // Verify item belongs to user's or guest's wishlist
  const wishlistItem = await prisma.wishlistItem.findFirst({
    where: {
      id: wishlistItemId,
      wishlist: wishlistWhere
    }
  });

  if (!wishlistItem) {
    throw new Error('Wishlist item not found');
  }

  await prisma.wishlistItem.delete({
    where: { id: wishlistItemId }
  });

  return { message: 'Item removed from wishlist' };
};

const moveToCart = async (userId = null, sessionId = null, wishlistItemId) => {
  // Ensure guest session exists if sessionId provided
  let guestSessionId = null;
  if (!userId && sessionId) {
    guestSessionId = await getGuestSessionId(sessionId);
    if (!guestSessionId) {
      throw new Error('Invalid session');
    }
  }

  const wishlistWhere = {};
  if (userId) {
    wishlistWhere.userId = userId;
  } else if (sessionId) {
    wishlistWhere.sessionId = guestSessionId;
  } else {
    throw new Error('Either userId or sessionId must be provided');
  }

  // Get wishlist item
  const wishlistItem = await prisma.wishlistItem.findFirst({
    where: {
      id: wishlistItemId,
      wishlist: wishlistWhere
    },
    include: { variant: true }
  });

  if (!wishlistItem) {
    throw new Error('Wishlist item not found');
  }

  if (!wishlistItem.variantId) {
    throw new Error('Please select a variant to add to cart');
  }

  // Add to cart
  const result = await addToCart(userId, sessionId, wishlistItem.variantId, 1);

  // Remove from wishlist
  await prisma.wishlistItem.delete({
    where: { id: wishlistItemId }
  });

  return {
    message: 'Moved to cart',
    cartItem: result.cartItem
  };
};

const clearWishlist = async (userId = null, sessionId = null) => {
  // Ensure guest session exists if sessionId provided
  let guestSessionId = null;
  if (!userId && sessionId) {
    guestSessionId = await getGuestSessionId(sessionId);
    if (!guestSessionId) {
      throw new Error('Invalid session');
    }
  }

  const whereClause = {};
  if (userId) {
    whereClause.userId = userId;
  } else if (sessionId) {
    whereClause.sessionId = guestSessionId;
  } else {
    throw new Error('Either userId or sessionId must be provided');
  }

  const wishlist = await prisma.wishlist.findFirst({ where: whereClause });

  if (!wishlist) {
    throw new Error('Wishlist not found');
  }

  await prisma.wishlistItem.deleteMany({
    where: { wishlistId: wishlist.id }
  });

  return { message: 'Wishlist cleared' };
};

module.exports = {
  // Cart
  getActiveCart,
  addToCart,
  updateCartItem,
  removeFromCart,
  clearCart,
  getCartSummary,
  // Wishlist
  getWishlist,
  addToWishlist,
  removeFromWishlist,
  moveToCart,
  clearWishlist
};


