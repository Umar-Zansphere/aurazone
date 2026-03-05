const path = require('node:path');
const jwt = require('jsonwebtoken');
const sharp = require('sharp');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const prisma = require('../config/prisma');

let uniqueCounter = 0;

const unique = (prefix = 'id') => `${prefix}-${Date.now()}-${uniqueCounter++}`;

const clearDatabase = async () => {
  await prisma.$transaction([
    prisma.paymentLog.deleteMany(),
    prisma.shipmentLog.deleteMany(),
    prisma.orderLog.deleteMany(),
    prisma.notificationHistory.deleteMany(),
    prisma.notificationPreferences.deleteMany(),
    prisma.pushSubscription.deleteMany(),
    prisma.payment.deleteMany(),
    prisma.orderShipment.deleteMany(),
    prisma.orderItem.deleteMany(),
    prisma.orderAddress.deleteMany(),
    prisma.order.deleteMany(),
    prisma.inventoryLog.deleteMany(),
    prisma.inventory.deleteMany(),
    prisma.productImage.deleteMany(),
    prisma.productVariant.deleteMany(),
    prisma.product.deleteMany(),
    prisma.cartItem.deleteMany(),
    prisma.cart.deleteMany(),
    prisma.wishlistItem.deleteMany(),
    prisma.wishlist.deleteMany(),
    prisma.address.deleteMany(),
    prisma.userSession.deleteMany(),
    prisma.otpVerification.deleteMany(),
    prisma.guestSession.deleteMany(),
    prisma.user.deleteMany(),
  ]);
};

const issueAccessToken = (userId) =>
  jwt.sign({ id: userId }, process.env.JWT_SECRET || 'dev-access-secret', { expiresIn: '1h' });

const createUser = async ({ role = 'CUSTOMER', email, fullName = 'Test User', isActive = true } = {}) => {
  const user = await prisma.user.create({
    data: {
      email: email || `${unique(role.toLowerCase())}@test.local`,
      fullName,
      role,
      is_active: isActive,
      isGuest: false,
      is_email_verified: new Date(),
    },
  });

  return user;
};

const createAuthContext = async () => {
  const admin = await createUser({ role: 'ADMIN', fullName: 'Admin User' });
  const customer = await createUser({ role: 'CUSTOMER', fullName: 'Customer User' });

  return {
    admin,
    customer,
    adminToken: issueAccessToken(admin.id),
    customerToken: issueAccessToken(customer.id),
  };
};

const createProductFixture = async ({
  quantity = 20,
  reserved = 0,
  price = 2499,
  compareAtPrice = 2999,
  category = 'RUNNING',
  gender = 'UNISEX',
} = {}) => {
  const product = await prisma.product.create({
    data: {
      name: `Runner ${unique('product')}`,
      brand: 'AuraZone',
      category,
      gender,
      description: 'Integration test product',
      shortDescription: 'Test product',
      tags: ['test', 'integration'],
      isActive: true,
      isFeatured: false,
    },
  });

  const variant = await prisma.productVariant.create({
    data: {
      productId: product.id,
      size: '9',
      color: 'Black',
      sku: unique('SKU'),
      price,
      compareAtPrice,
      isAvailable: true,
    },
  });

  const inventory = await prisma.inventory.create({
    data: {
      variantId: variant.id,
      quantity,
      reserved,
    },
  });

  return { product, variant, inventory };
};

const createOrderFixture = async ({
  userId = null,
  variantId,
  quantity = 2,
  paymentMethod = 'COD',
  status = 'PENDING',
  paymentStatus = 'PENDING',
  totalAmount = 4998,
  reserveInventory = false,
} = {}) => {
  const variant = await prisma.productVariant.findUnique({
    where: { id: variantId },
    include: { product: true, inventory: true },
  });

  if (!variant) {
    throw new Error('Variant not found for createOrderFixture');
  }

  if (reserveInventory) {
    await prisma.inventory.update({
      where: { variantId },
      data: {
        reserved: {
          increment: quantity,
        },
      },
    });
  }

  const order = await prisma.order.create({
    data: {
      userId,
      orderNumber: `ORD-${unique('order')}`,
      trackingToken: `TRK-${unique('track')}`,
      status,
      paymentStatus,
      paymentMethod,
      totalAmount,
      items: {
        create: [
          {
            variantId,
            productName: variant.product.name,
            color: variant.color,
            size: variant.size,
            price: variant.price,
            quantity,
            subtotal: Number(variant.price) * quantity,
          },
        ],
      },
      orderAddress: {
        create: {
          name: 'Test Buyer',
          phone: '9999999999',
          email: 'buyer@test.local',
          addressLine1: '123 Test St',
          city: 'Test City',
          state: 'TS',
          postalCode: '123456',
          country: 'IN',
        },
      },
    },
    include: {
      items: true,
      orderAddress: true,
    },
  });

  return order;
};

const createPaymentFixture = async ({
  orderId,
  gateway = 'COD',
  status = 'PENDING',
  amount = 4998,
  note = 'seed payment',
} = {}) => {
  return prisma.payment.create({
    data: {
      orderId,
      gateway,
      amount,
      status,
      note,
      idempotencyKey: unique('idem'),
      ...(status === 'SUCCESS' ? { paidAt: new Date() } : {}),
      ...(gateway === 'RAZORPAY'
        ? {
          gatewayOrderId: unique('gord'),
          gatewayPaymentId: unique('gpay'),
        }
        : {}),
    },
  });
};

const createShipmentFixture = async ({
  orderId,
  status = 'PENDING',
  courierName = 'DHL',
  trackingNumber,
  trackingUrl,
} = {}) => {
  return prisma.orderShipment.create({
    data: {
      orderId,
      status,
      courierName,
      trackingNumber: trackingNumber || unique('trkno'),
      trackingUrl: trackingUrl || 'https://tracking.test.local',
      ...(status === 'SHIPPED' || status === 'DELIVERED' ? { shippedAt: new Date() } : {}),
    },
  });
};

const createTestImageBuffer = async () => {
  return sharp({
    create: {
      width: 320,
      height: 320,
      channels: 3,
      background: { r: 180, g: 80, b: 40 },
    },
  })
    .png()
    .toBuffer();
};

module.exports = {
  prisma,
  unique,
  clearDatabase,
  issueAccessToken,
  createUser,
  createAuthContext,
  createProductFixture,
  createOrderFixture,
  createPaymentFixture,
  createShipmentFixture,
  createTestImageBuffer,
};
