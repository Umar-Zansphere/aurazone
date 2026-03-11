const prisma = require('../../config/prisma');
const { Prisma } = require('@prisma/client');
const razorpayService = require('./razorpay.services');
const { sendEmail } = require('../../config/email');
const notificationService = require('./notification.service');
const crypto = require('crypto');

const SUPPORTED_PAYMENT_METHODS = new Set(['COD', 'RAZORPAY']);
const ORDER_TX_OPTIONS = {
  maxWait: 10_000,
  timeout: 20_000,
};
const RAZORPAY_INIT_PENDING_ERROR_CODE = 'RAZORPAY_INIT_PENDING';

const normalizePaymentMethod = (paymentMethod) => {
  const normalized = typeof paymentMethod === 'string'
    ? paymentMethod.trim().toUpperCase()
    : '';

  if (!SUPPORTED_PAYMENT_METHODS.has(normalized)) {
    throw new Error('Invalid payment method. Supported methods: COD, RAZORPAY');
  }

  return normalized;
};

const getInitialOrderStatusForPaymentMethod = (paymentMethod) =>
  paymentMethod === 'COD' ? 'RECEIVED' : 'PENDING';

const generateOrderNumber = () =>
  `ORD-${Date.now()}-${Math.random().toString(36).slice(2, 11).toUpperCase()}`;

const groupItemsByVariant = (items = []) => {
  const groupedItems = new Map();

  for (const item of items) {
    if (!groupedItems.has(item.variantId)) {
      groupedItems.set(item.variantId, {
        variantId: item.variantId,
        quantity: 0,
        item,
      });
    }

    groupedItems.get(item.variantId).quantity += item.quantity;
  }

  return Array.from(groupedItems.values());
};

const getUniqueVariantIds = (items) =>
  [...new Set(items.map((item) => item.variantId).filter(Boolean))];

const ensureInventoryRowsForVariantsTx = async (tx, variantIds) => {
  if (variantIds.length === 0) {
    return;
  }

  await tx.inventory.createMany({
    data: variantIds.map((variantId) => ({
      variantId,
      quantity: 0,
      reserved: 0,
    })),
    skipDuplicates: true,
  });
};

const lockInventoryRowsForVariantsTx = async (tx, variantIds) => {
  if (variantIds.length === 0) {
    return [];
  }

  await ensureInventoryRowsForVariantsTx(tx, variantIds);

  const rows = await tx.$queryRaw`
    SELECT "id", "variantId", "quantity", "reserved"
    FROM "Inventory"
    WHERE "variantId" IN (${Prisma.join(variantIds)})
    ORDER BY "variantId"
    FOR UPDATE
  `;

  if (!rows || rows.length !== variantIds.length) {
    throw new Error('Inventory rows could not be locked for all variants');
  }

  return rows.map((row) => ({
    id: row.id,
    variantId: row.variantId,
    quantity: Number(row.quantity),
    reserved: Number(row.reserved),
  }));
};

const buildVariantQuantityValuesSql = (items) =>
  Prisma.join(items.map((item) => Prisma.sql`(${item.variantId}, ${item.quantity})`));

const reserveInventoryForOrderTx = async (tx, orderId, cartItems, note) => {
  const groupedItems = groupItemsByVariant(cartItems);
  if (groupedItems.length === 0) {
    return;
  }

  const variantIds = getUniqueVariantIds(groupedItems);
  const lockedRows = await lockInventoryRowsForVariantsTx(tx, variantIds);
  const inventoryByVariantId = new Map(lockedRows.map((row) => [row.variantId, row]));

  for (const groupedItem of groupedItems) {
    const inventory = inventoryByVariantId.get(groupedItem.variantId);
    if (!inventory) {
      throw new Error(`Inventory row could not be locked for variant ${groupedItem.variantId}`);
    }

    const availableQuantity = inventory.quantity - inventory.reserved;
    if (availableQuantity < groupedItem.quantity) {
      const { item } = groupedItem;
      const variantLabel = `${item.variant.product.name} (${item.variant.color} / ${item.variant.size})`;
      throw new Error(
        `Insufficient inventory for ${variantLabel}. Requested ${groupedItem.quantity}, available ${Math.max(availableQuantity, 0)}`
      );
    }
  }

  const valuesSql = buildVariantQuantityValuesSql(groupedItems);
  await tx.$executeRaw`
    UPDATE "Inventory" AS i
    SET
      "reserved" = i."reserved" + (v."quantity")::int,
      "updatedAt" = NOW()
    FROM (VALUES ${valuesSql}) AS v("variantId", "quantity")
    WHERE i."variantId" = (v."variantId")::text
  `;

  await tx.inventoryLog.createMany({
    data: groupedItems.map((groupedItem) => ({
      variantId: groupedItem.variantId,
      orderId,
      type: 'HOLD',
      quantity: groupedItem.quantity,
      note,
    })),
  });
};

const releaseInventoryForOrderTx = async (tx, orderId, orderItems, note) => {
  const groupedItems = groupItemsByVariant(orderItems);
  if (groupedItems.length === 0) {
    return;
  }

  const variantIds = getUniqueVariantIds(groupedItems);
  const lockedRows = await lockInventoryRowsForVariantsTx(tx, variantIds);
  const inventoryByVariantId = new Map(lockedRows.map((row) => [row.variantId, row]));

  const releaseItems = [];
  for (const groupedItem of groupedItems) {
    const inventory = inventoryByVariantId.get(groupedItem.variantId);
    if (!inventory) {
      continue;
    }

    const releaseQuantity = Math.min(groupedItem.quantity, inventory.reserved);
    if (releaseQuantity > 0) {
      releaseItems.push({
        variantId: groupedItem.variantId,
        quantity: releaseQuantity,
      });
    }
  }

  if (releaseItems.length === 0) {
    return;
  }

  const valuesSql = buildVariantQuantityValuesSql(releaseItems);
  await tx.$executeRaw`
    UPDATE "Inventory" AS i
    SET
      "reserved" = GREATEST(i."reserved" - (v."quantity")::integer, 0),
      "updatedAt" = NOW()
    FROM (VALUES ${valuesSql}) AS v("variantId", "quantity")
    WHERE i."variantId" = (v."variantId")::uuid
  `;

  await tx.inventoryLog.createMany({
    data: releaseItems.map((releaseItem) => ({
      variantId: releaseItem.variantId,
      orderId,
      type: 'RELEASE',
      quantity: releaseItem.quantity,
      note,
    })),
  });
};

const rollbackOrderForPaymentInitFailure = async (orderId, reason) => {
  try {
    await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: { items: true },
      });

      if (!order || order.paymentStatus !== 'PENDING') {
        return;
      }

      await tx.order.update({
        where: { id: orderId },
        data: {
          // Keep order open for retry when payment gateway init fails.
          status: 'PENDING',
          paymentStatus: 'PENDING',
        },
      });

      await releaseInventoryForOrderTx(
        tx,
        order.id,
        order.items,
        `Payment initialization failed: ${reason}`
      );
    });
  } catch (cleanupError) {
    console.error(`Failed to rollback order ${orderId} after payment initialization failure:`, cleanupError);
  }
};

const upsertPendingRazorpayPayment = async ({ orderId, razorpayOrderId, amount }) => {
  if (!orderId || !razorpayOrderId) {
    throw new Error('orderId and razorpayOrderId are required to initialize payment');
  }

  const normalizedAmount = Number(amount);
  if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
    throw new Error('Valid amount is required to initialize payment');
  }

  const idempotencyKey = `rzp-init-${orderId}`;

  await prisma.payment.upsert({
    where: {
      gateway_gatewayOrderId: {
        gateway: 'RAZORPAY',
        gatewayOrderId: razorpayOrderId,
      },
    },
    update: {
      orderId,
      amount: normalizedAmount,
      status: 'PENDING',
      paidAt: null,
      idempotencyKey,
      deletedAt: null,
      deleteReason: null,
      deletedBy: null,
    },
    create: {
      orderId,
      gateway: 'RAZORPAY',
      gatewayOrderId: razorpayOrderId,
      amount: normalizedAmount,
      status: 'PENDING',
      paidAt: null,
      idempotencyKey,
    },
  });
};

const markOrderCreationFailed = async (orderId, reason) => {
  if (!orderId) {
    return;
  }

  try {
    await prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'FAILED',
        paymentStatus: 'FAILED',
      },
    });
  } catch (statusError) {
    console.error(`Failed to mark order ${orderId} as FAILED after creation error (${reason}):`, statusError);
  }
};

const notifyLowStockForItems = async (items, errorPrefix) => {
  try {
    const seenVariants = new Set();

    for (const item of items) {
      if (seenVariants.has(item.variantId)) {
        continue;
      }

      seenVariants.add(item.variantId);
      const inventory = await prisma.inventory.findUnique({ where: { variantId: item.variantId } });

      if (inventory && (inventory.quantity - inventory.reserved) <= 5) {
        const productName = item.variant.product.name;
        const variantInfo = `${item.variant.color} / ${item.variant.size}`;
        await notificationService.notifyLowStock(
          item.variant.productId,
          `${productName} (${variantInfo})`,
          inventory.quantity - inventory.reserved
        );
      }
    }
  } catch (error) {
    console.error(`${errorPrefix}:`, error);
  }
};

const clearCheckedOutCartItems = async (cartId, checkedOutItems = []) => {
  const cartItemIds = checkedOutItems
    .map((item) => item.id)
    .filter(Boolean);

  if (!cartId || cartItemIds.length === 0) {
    return;
  }

  try {
    await prisma.cartItem.deleteMany({
      where: {
        cartId,
        id: { in: cartItemIds },
      },
    });
  } catch (error) {
    console.error(`Failed to clear checked out items from cart ${cartId}:`, error);
  }
};

const getOrderByTrackingToken = async (trackingToken) => {
  const order = await prisma.order.findUnique({
    where: { trackingToken },
    include: {
      items: {
        include: {
          variant: { include: { product: true } }
        }
      },
      shipments: true,
      orderAddress: true,
    }
  });

  if (!order) {
    throw new Error('Order not found');
  }

  return order;
};

// ======================== ORDER CANCELLATION ========================

const cancelOrder = async (orderId, reason = '') => {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) {
    throw new Error('Order not found');
  }

  if (order.status === 'DELIVERED') {
    throw new Error('Cannot cancel a delivered order');
  }

  if (order.status === 'CANCELLED') {
    throw new Error('Order is already cancelled');
  }

  // Update order status
  const updatedOrder = await prisma.order.update({
    where: { id: orderId },
    data: {
      status: 'CANCELLED',
      paymentStatus: 'FAILED' // Mark payment as failed on cancellation
    },
    include: {
      user: true,
      items: true,
      payments: true,
      shipments: true,
    }
  });

  // Release inventory for all items
  for (const item of updatedOrder.items) {
    // Add a RELEASE log
    await prisma.inventoryLog.create({
      data: {
        variantId: item.variantId,
        type: 'RELEASE',
        quantity: item.quantity,
        orderId,
        note: `Order cancelled. ${reason}`
      }
    });

    // Update Inventory table: decrement reserved
    await prisma.inventory.update({
      where: { variantId: item.variantId },
      data: { reserved: { decrement: item.quantity } }
    }).catch(err => console.error(`Failed to release inventory for variant ${item.variantId}:`, err));
  }

  return {
    message: 'Order cancelled successfully',
    order: updatedOrder
  };
};

// ======================== ORDER ITEMS ========================

const getOrderItems = async (orderId) => {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) {
    throw new Error('Order not found');
  }

  const items = await prisma.orderItem.findMany({
    where: { orderId },
    include: {
      variant: { include: { product: true } }
    }
  });

  return items;
};

// ======================== CUSTOMER-FACING ORDER ENDPOINTS ========================


const SHIPPING_FEE = 40;

const createOrderFromCart = async (userId, orderData) => {
  const { addressId, paymentMethod } = orderData;

  if (!addressId || !paymentMethod) {
    throw new Error('Address ID and payment method are required');
  }

  const normalizedPaymentMethod = normalizePaymentMethod(paymentMethod);

  const cart = await prisma.cart.findFirst({
    where: { userId, status: 'ACTIVE' },
    include: { items: { include: { variant: { include: { product: true } } } } },
  });

  if (!cart || cart.items.length === 0) {
    throw new Error('Cart is empty');
  }

  const address = await prisma.address.findUnique({ where: { id: addressId } });
  if (!address || address.userId !== userId) {
    throw new Error('Address not found or unauthorized');
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });

  const cartTotal = cart.items.reduce((sum, item) => sum + (parseFloat(item.unitPrice) * item.quantity), 0);
  const totalAmount = cartTotal + SHIPPING_FEE;
  const orderNumber = generateOrderNumber();
  const trackingToken = crypto.randomBytes(16).toString('hex');

  const order = await prisma.$transaction(async (tx) => {
    const newOrder = await tx.order.create({
      data: {
        userId,
        orderNumber,
        trackingToken,
        status: getInitialOrderStatusForPaymentMethod(normalizedPaymentMethod),
        paymentStatus: 'PENDING',
        paymentMethod: normalizedPaymentMethod,
        totalAmount: parseFloat(totalAmount),
        items: {
          create: cart.items.map((item) => ({
            variantId: item.variantId,
            productName: item.variant.product.name,
            color: item.variant.color,
            size: item.variant.size,
            price: item.unitPrice,
            quantity: item.quantity,
            subtotal: parseFloat(item.unitPrice) * item.quantity,
          })),
        },
      },
      include: {
        items: { include: { variant: { include: { product: true } } } },
        payments: true,
        shipments: true,
      },
    });

    await tx.orderAddress.create({
      data: {
        orderId: newOrder.id,
        name: address.name,
        phone: address.phone,
        addressLine1: address.addressLine1,
        addressLine2: address.addressLine2,
        city: address.city,
        state: address.state,
        postalCode: address.postalCode,
        country: address.country,
      },
    });

    await tx.orderShipment.create({
      data: {
        orderId: newOrder.id,
        status: 'PENDING',
      },
    });

    await reserveInventoryForOrderTx(
      tx,
      newOrder.id,
      cart.items,
      'Order created, awaiting payment'
    );

    return newOrder;
  }, ORDER_TX_OPTIONS);

  let orderAddress = null;
  let razorpayOrderDetails = null;

  try {
    orderAddress = await prisma.orderAddress.findFirst({
      where: { orderId: order.id },
    });

    if (normalizedPaymentMethod === 'RAZORPAY') {
      try {
        razorpayOrderDetails = await razorpayService.createRazorpayOrder({
          orderId: order.id,
          amount: totalAmount,
          customerEmail: user.email,
          customerPhone: user.phone,
          customerName: user.fullName,
        });

        await prisma.order.update({
          where: { id: order.id },
          data: { razorpayOrderId: razorpayOrderDetails.razorpayOrderId },
        });
        await upsertPendingRazorpayPayment({
          orderId: order.id,
          razorpayOrderId: razorpayOrderDetails.razorpayOrderId,
          amount: totalAmount,
        });
      } catch (error) {
        console.error('Error creating Razorpay order:', error);
        await rollbackOrderForPaymentInitFailure(order.id, error.message);

        const paymentInitError = new Error(`Failed to initialize payment: ${error.message}`);
        paymentInitError.code = RAZORPAY_INIT_PENDING_ERROR_CODE;
        throw paymentInitError;
      }
    }
  } catch (error) {
    if (error?.code !== RAZORPAY_INIT_PENDING_ERROR_CODE) {
      await markOrderCreationFailed(order.id, error.message);
    }
    throw error;
  }

  await clearCheckedOutCartItems(cart.id, cart.items);

  // Send order confirmation email only for COD orders
  // For Razorpay, confirmation will be sent after payment verification
  if (normalizedPaymentMethod === 'COD') {
    try {
      await sendEmail(
        user.email,
        'Order Confirmation - ' + order.orderNumber,
        'order-confirmation',
        {
          customerName: user.fullName,
          orderId: order.id,
          orderNumber: order.orderNumber,
          status: order.status,
          paymentMethod: order.paymentMethod,
          totalAmount: order.totalAmount,
          shippingFee: SHIPPING_FEE,
          createdAt: order.createdAt,
          items: order.items.map((item) => ({
            productName: item.productName,
            color: item.color,
            size: item.size,
            quantity: item.quantity,
            price: item.price,
            subtotal: item.subtotal,
          })),
          addressLine1: orderAddress?.addressLine1 || '',
          addressLine2: orderAddress?.addressLine2 || '',
          city: orderAddress?.city || '',
          state: orderAddress?.state || '',
          postalCode: orderAddress?.postalCode || '',
          country: orderAddress?.country || '',
          phone: orderAddress?.phone || user.phone || '',
          trackingUrl: `${process.env.CLIENT_URL || 'http://localhost:3000'}/orders/${order.id}`,
        }
      );
    } catch (emailError) {
      console.error('Error sending order confirmation email:', emailError);
    }
  }

  try {
    await notificationService.notifyNewOrder(order.id, {
      orderNumber: order.orderNumber,
      customerName: user.fullName,
      total: order.totalAmount,
    });
  } catch (notificationError) {
    console.error('Error sending admin notification:', notificationError);
  }

  await notifyLowStockForItems(cart.items, 'Error sending low stock notification');

  return {
    orderId: order.id,
    orderNumber: order.orderNumber,
    totalAmount: order.totalAmount,
    shippingFee: SHIPPING_FEE,
    status: order.status,
    paymentStatus: order.paymentStatus,
    paymentMethod: order.paymentMethod,
    items: order.items,
    ...(razorpayOrderDetails && {
      razorpayOrderId: razorpayOrderDetails.razorpayOrderId,
      razorpayAmount: razorpayOrderDetails.amount,
      razorpayCurrency: razorpayOrderDetails.currency,
    }),
    ...(order.paymentMethod === 'COD' && {
      message: 'Order created successfully. Payment to be collected on delivery.',
    }),
  };
};

/**
 * Create order from cart for guest users
 * Flow: Create guest user → Create address → Create order
 */

const createOrderFromCartAsGuest = async (sessionId, orderData) => {
  const { address, paymentMethod } = orderData;

  if (!address || !paymentMethod) {
    throw new Error('Address and payment method are required');
  }

  if (!address.email || !address.phone) {
    throw new Error('Email and phone are required in address');
  }

  const normalizedPaymentMethod = normalizePaymentMethod(paymentMethod);

  const session = await prisma.guestSession.findUnique({
    where: { sessionId },
  });

  if (!session) {
    throw new Error('Invalid session ID');
  }

  const cart = await prisma.cart.findFirst({
    where: { sessionId: session.id, status: 'ACTIVE' },
    include: { items: { include: { variant: { include: { product: true } } } } },
  });

  if (!cart || cart.items.length === 0) {
    throw new Error('Cart is empty');
  }

  const cartTotal = cart.items.reduce((sum, item) => sum + (parseFloat(item.unitPrice) * item.quantity), 0);
  const totalAmount = cartTotal + SHIPPING_FEE;
  const orderNumber = generateOrderNumber();
  const trackingToken = crypto.randomBytes(16).toString('hex');

  const order = await prisma.$transaction(async (tx) => {
    const newOrder = await tx.order.create({
      data: {
        sessionId: session.id,
        orderNumber,
        trackingToken,
        status: getInitialOrderStatusForPaymentMethod(normalizedPaymentMethod),
        paymentStatus: 'PENDING',
        paymentMethod: normalizedPaymentMethod,
        totalAmount: parseFloat(totalAmount),
        items: {
          create: cart.items.map((item) => ({
            variantId: item.variantId,
            productName: item.variant.product.name,
            color: item.variant.color,
            size: item.variant.size,
            price: item.unitPrice,
            quantity: item.quantity,
            subtotal: parseFloat(item.unitPrice) * item.quantity,
          })),
        },
      },
      include: {
        items: { include: { variant: { include: { product: true } } } },
        payments: true,
        shipments: true,
      },
    });

    await tx.orderAddress.create({
      data: {
        orderId: newOrder.id,
        name: address.name,
        phone: address.phone,
        email: address.email,
        addressLine1: address.addressLine1,
        addressLine2: address.addressLine2 || null,
        city: address.city,
        state: address.state,
        postalCode: address.postalCode,
        country: address.country,
      },
    });

    await tx.orderShipment.create({
      data: {
        orderId: newOrder.id,
        status: 'PENDING',
      },
    });

    await reserveInventoryForOrderTx(
      tx,
      newOrder.id,
      cart.items,
      'Guest order created, awaiting payment'
    );

    return newOrder;
  }, ORDER_TX_OPTIONS);

  let orderAddress = null;
  let razorpayOrderDetails = null;

  try {
    orderAddress = await prisma.orderAddress.findFirst({
      where: { orderId: order.id },
    });

    if (normalizedPaymentMethod === 'RAZORPAY') {
      try {
        razorpayOrderDetails = await razorpayService.createRazorpayOrder({
          orderId: order.id,
          amount: totalAmount,
          customerEmail: address.email,
          customerPhone: address.phone,
          customerName: address.name,
        });

        await prisma.order.update({
          where: { id: order.id },
          data: { razorpayOrderId: razorpayOrderDetails.razorpayOrderId },
        });
        await upsertPendingRazorpayPayment({
          orderId: order.id,
          razorpayOrderId: razorpayOrderDetails.razorpayOrderId,
          amount: totalAmount,
        });
      } catch (error) {
        console.error('Error creating Razorpay order:', error);
        await rollbackOrderForPaymentInitFailure(order.id, error.message);

        const paymentInitError = new Error(`Failed to initialize payment: ${error.message}`);
        paymentInitError.code = RAZORPAY_INIT_PENDING_ERROR_CODE;
        throw paymentInitError;
      }
    }
  } catch (error) {
    if (error?.code !== RAZORPAY_INIT_PENDING_ERROR_CODE) {
      await markOrderCreationFailed(order.id, error.message);
    }
    throw error;
  }

  await clearCheckedOutCartItems(cart.id, cart.items);

  // Send order confirmation email only for COD orders
  // For Razorpay, confirmation will be sent after payment verification
  if (normalizedPaymentMethod === 'COD') {
    try {
      await sendEmail(
        address.email,
        'Order Confirmation - ' + order.orderNumber,
        'order-confirmation',
        {
          customerName: address.name,
          orderId: order.id,
          orderNumber: order.orderNumber,
          trackingToken: order.trackingToken,
          status: order.status,
          paymentMethod: order.paymentMethod,
          totalAmount: order.totalAmount,
          shippingFee: SHIPPING_FEE,
          createdAt: order.createdAt,
          items: order.items.map((item) => ({
            productName: item.productName,
            color: item.color,
            size: item.size,
            quantity: item.quantity,
            price: item.price,
            subtotal: item.subtotal,
          })),
          addressLine1: orderAddress?.addressLine1 || '',
          addressLine2: orderAddress?.addressLine2 || '',
          city: orderAddress?.city || '',
          state: orderAddress?.state || '',
          postalCode: orderAddress?.postalCode || '',
          country: orderAddress?.country || '',
          phone: orderAddress?.phone || address.phone || '',
          trackingUrl: `${process.env.CLIENT_URL || 'http://localhost:3000'}/track-order/${order.trackingToken}`,
        }
      );
    } catch (emailError) {
      console.error('Error sending order confirmation email:', emailError);
    }
  }

  try {
    await notificationService.notifyNewOrder(order.id, {
      orderNumber: order.orderNumber,
      customerName: address.name,
      total: order.totalAmount,
    });
  } catch (notificationError) {
    console.error('Error sending admin notification:', notificationError);
  }

  await notifyLowStockForItems(cart.items, 'Error sending low stock notification for guest order');

  return {
    orderId: order.id,
    orderNumber: order.orderNumber,
    trackingToken: order.trackingToken,
    totalAmount: order.totalAmount,
    shippingFee: SHIPPING_FEE,
    status: order.status,
    paymentStatus: order.paymentStatus,
    paymentMethod: order.paymentMethod,
    items: order.items,
    // Return Razorpay details if applicable
    ...(razorpayOrderDetails && {
      razorpayOrderId: razorpayOrderDetails.razorpayOrderId,
      razorpayAmount: razorpayOrderDetails.amount,
      razorpayCurrency: razorpayOrderDetails.currency,
    }),
    ...(order.paymentMethod === 'COD' && {
      message: 'Order created successfully. Payment to be collected on delivery.',
    }),
  };
};

// ======================== DIRECT ORDER ENDPOINTS (BUY NOW) ========================

const createDirectOrder = async (userId, orderData) => {
  const { addressId, paymentMethod, variantId, quantity } = orderData;

  if (!addressId || !paymentMethod || !variantId || !quantity) {
    throw new Error('Address ID, payment method, variant ID, and quantity are required');
  }

  const normalizedPaymentMethod = normalizePaymentMethod(paymentMethod);

  // Fetch the variant and its product details
  const variant = await prisma.productVariant.findUnique({
    where: { id: variantId },
    include: { product: true }
  });

  if (!variant || !variant.isAvailable) {
    throw new Error('Product not available');
  }

  const address = await prisma.address.findUnique({ where: { id: addressId } });
  if (!address || address.userId !== userId) {
    throw new Error('Address not found or unauthorized');
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });

  const unitPrice = parseFloat(variant.price);
  const qty = parseInt(quantity, 10);
  const cartTotal = unitPrice * qty;
  const totalAmount = cartTotal + SHIPPING_FEE;
  const orderNumber = generateOrderNumber();
  const trackingToken = crypto.randomBytes(16).toString('hex');

  // We mock a cart item array for the reserve inventory method
  const mockItems = [{
    variantId: variant.id,
    quantity: qty,
    unitPrice: variant.price,
    variant: {
      ...variant,
      product: variant.product
    }
  }];

  const order = await prisma.$transaction(async (tx) => {
    const newOrder = await tx.order.create({
      data: {
        userId,
        orderNumber,
        trackingToken,
        status: getInitialOrderStatusForPaymentMethod(normalizedPaymentMethod),
        paymentStatus: 'PENDING',
        paymentMethod: normalizedPaymentMethod,
        totalAmount: parseFloat(totalAmount),
        items: {
          create: [{
            variantId: variant.id,
            productName: variant.product.name,
            color: variant.color,
            size: variant.size,
            price: variant.price,
            quantity: qty,
            subtotal: parseFloat(variant.price) * qty,
          }],
        },
      },
      include: {
        items: { include: { variant: { include: { product: true } } } },
        payments: true,
        shipments: true,
      },
    });

    await tx.orderAddress.create({
      data: {
        orderId: newOrder.id,
        name: address.name,
        phone: address.phone,
        addressLine1: address.addressLine1,
        addressLine2: address.addressLine2,
        city: address.city,
        state: address.state,
        postalCode: address.postalCode,
        country: address.country,
      },
    });

    await tx.orderShipment.create({
      data: {
        orderId: newOrder.id,
        status: 'PENDING',
      },
    });

    await reserveInventoryForOrderTx(
      tx,
      newOrder.id,
      mockItems,
      'Direct order created, awaiting payment'
    );

    return newOrder;
  }, ORDER_TX_OPTIONS);

  let orderAddress = null;
  let razorpayOrderDetails = null;

  try {
    orderAddress = await prisma.orderAddress.findFirst({
      where: { orderId: order.id },
    });

    if (normalizedPaymentMethod === 'RAZORPAY') {
      try {
        razorpayOrderDetails = await razorpayService.createRazorpayOrder({
          orderId: order.id,
          amount: totalAmount,
          customerEmail: user.email,
          customerPhone: user.phone,
          customerName: user.fullName,
        });

        await prisma.order.update({
          where: { id: order.id },
          data: { razorpayOrderId: razorpayOrderDetails.razorpayOrderId },
        });
        await upsertPendingRazorpayPayment({
          orderId: order.id,
          razorpayOrderId: razorpayOrderDetails.razorpayOrderId,
          amount: totalAmount,
        });
      } catch (error) {
        console.error('Error creating Razorpay order:', error);
        await rollbackOrderForPaymentInitFailure(order.id, error.message);

        const paymentInitError = new Error(`Failed to initialize payment: ${error.message}`);
        paymentInitError.code = RAZORPAY_INIT_PENDING_ERROR_CODE;
        throw paymentInitError;
      }
    }
  } catch (error) {
    if (error?.code !== RAZORPAY_INIT_PENDING_ERROR_CODE) {
      await markOrderCreationFailed(order.id, error.message);
    }
    throw error;
  }

  // No cart clear needed for direct orders!

  if (normalizedPaymentMethod === 'COD') {
    try {
      await sendEmail(
        user.email,
        'Order Confirmation - ' + order.orderNumber,
        'order-confirmation',
        {
          customerName: user.fullName,
          orderId: order.id,
          orderNumber: order.orderNumber,
          status: order.status,
          paymentMethod: order.paymentMethod,
          totalAmount: order.totalAmount,
          shippingFee: SHIPPING_FEE,
          createdAt: order.createdAt,
          items: order.items.map((item) => ({
            productName: item.productName,
            color: item.color,
            size: item.size,
            quantity: item.quantity,
            price: item.price,
            subtotal: item.subtotal,
          })),
          addressLine1: orderAddress?.addressLine1 || '',
          addressLine2: orderAddress?.addressLine2 || '',
          city: orderAddress?.city || '',
          state: orderAddress?.state || '',
          postalCode: orderAddress?.postalCode || '',
          country: orderAddress?.country || '',
          phone: orderAddress?.phone || user.phone || '',
          trackingUrl: `${process.env.CLIENT_URL || 'http://localhost:3000'}/orders/${order.id}`,
        }
      );
    } catch (emailError) {
      console.error('Error sending order confirmation email:', emailError);
    }
  }

  try {
    await notificationService.notifyNewOrder(order.id, {
      orderNumber: order.orderNumber,
      customerName: user.fullName,
      total: order.totalAmount,
    });
  } catch (notificationError) {
    console.error('Error sending admin notification:', notificationError);
  }

  await notifyLowStockForItems(mockItems, 'Error sending low stock notification');

  return {
    orderId: order.id,
    orderNumber: order.orderNumber,
    totalAmount: order.totalAmount,
    shippingFee: SHIPPING_FEE,
    status: order.status,
    paymentStatus: order.paymentStatus,
    paymentMethod: order.paymentMethod,
    items: order.items,
    ...(razorpayOrderDetails && {
      razorpayOrderId: razorpayOrderDetails.razorpayOrderId,
      razorpayAmount: razorpayOrderDetails.amount,
      razorpayCurrency: razorpayOrderDetails.currency,
    }),
    ...(order.paymentMethod === 'COD' && {
      message: 'Order created successfully. Payment to be collected on delivery.',
    }),
  };
};

const createDirectOrderAsGuest = async (sessionId, orderData) => {
  const { address, paymentMethod, variantId, quantity } = orderData;

  if (!address || !paymentMethod || !variantId || !quantity) {
    throw new Error('Address, payment method, variant ID, and quantity are required');
  }

  if (!address.email || !address.phone) {
    throw new Error('Email and phone are required in address');
  }

  const normalizedPaymentMethod = normalizePaymentMethod(paymentMethod);

  const session = await prisma.guestSession.findUnique({
    where: { sessionId },
  });

  if (!session) {
    throw new Error('Session not found');
  }

  // Fetch the variant and its product details
  const variant = await prisma.productVariant.findUnique({
    where: { id: variantId },
    include: { product: true }
  });

  if (!variant || !variant.isAvailable) {
    throw new Error('Product not available');
  }

  const unitPrice = parseFloat(variant.price);
  const qty = parseInt(quantity, 10);
  const cartTotal = unitPrice * qty;
  const totalAmount = cartTotal + SHIPPING_FEE;
  const orderNumber = generateOrderNumber();
  const trackingToken = crypto.randomBytes(16).toString('hex');

  // We mock a cart item array for the reserve inventory method
  const mockItems = [{
    variantId: variant.id,
    quantity: qty,
    unitPrice: variant.price,
    variant: {
      ...variant,
      product: variant.product
    }
  }];

  const order = await prisma.$transaction(async (tx) => {
    const newOrder = await tx.order.create({
      data: {
        sessionId: session.id,
        orderNumber,
        trackingToken,
        status: getInitialOrderStatusForPaymentMethod(normalizedPaymentMethod),
        paymentStatus: 'PENDING',
        paymentMethod: normalizedPaymentMethod,
        totalAmount: parseFloat(totalAmount),
        items: {
          create: [{
            variantId: variant.id,
            productName: variant.product.name,
            color: variant.color,
            size: variant.size,
            price: variant.price,
            quantity: qty,
            subtotal: parseFloat(variant.price) * qty,
          }],
        },
      },
      include: {
        items: { include: { variant: { include: { product: true } } } },
        payments: true,
        shipments: true,
      },
    });

    await tx.orderAddress.create({
      data: {
        orderId: newOrder.id,
        name: address.name,
        phone: address.phone,
        email: address.email,
        addressLine1: address.addressLine1,
        addressLine2: address.addressLine2 || null,
        city: address.city,
        state: address.state,
        postalCode: address.postalCode,
        country: address.country,
      },
    });

    await tx.orderShipment.create({
      data: {
        orderId: newOrder.id,
        status: 'PENDING',
      },
    });

    await reserveInventoryForOrderTx(
      tx,
      newOrder.id,
      mockItems,
      'Guest order created directly, awaiting payment'
    );

    return newOrder;
  }, ORDER_TX_OPTIONS);

  let razorpayOrderDetails = null;
  let orderAddress = null;

  try {
    if (normalizedPaymentMethod === 'RAZORPAY') {
      try {
        razorpayOrderDetails = await razorpayService.createRazorpayOrder({
          orderId: order.id,
          amount: totalAmount,
          customerEmail: address.email,
          customerPhone: address.phone,
          customerName: address.name,
        });

        await prisma.order.update({
          where: { id: order.id },
          data: { razorpayOrderId: razorpayOrderDetails.razorpayOrderId },
        });
        await upsertPendingRazorpayPayment({
          orderId: order.id,
          razorpayOrderId: razorpayOrderDetails.razorpayOrderId,
          amount: totalAmount,
        });
      } catch (error) {
        console.error('Error creating Razorpay order:', error);
        await rollbackOrderForPaymentInitFailure(order.id, error.message);

        const paymentInitError = new Error(`Failed to initialize payment: ${error.message}`);
        paymentInitError.code = RAZORPAY_INIT_PENDING_ERROR_CODE;
        throw paymentInitError;
      }
    }

    orderAddress = await prisma.orderAddress.findFirst({
      where: { orderId: order.id },
    });
  } catch (error) {
    if (error?.code !== RAZORPAY_INIT_PENDING_ERROR_CODE) {
      await markOrderCreationFailed(order.id, error.message);
    }
    throw error;
  }

  // No cart clear needed for direct orders!

  if (normalizedPaymentMethod === 'COD') {
    try {
      await sendEmail(
        address.email,
        'Order Confirmation - ' + order.orderNumber,
        'order-confirmation',
        {
          customerName: address.name,
          orderId: order.id,
          orderNumber: order.orderNumber,
          trackingToken: order.trackingToken,
          status: order.status,
          paymentMethod: order.paymentMethod,
          totalAmount: order.totalAmount,
          shippingFee: SHIPPING_FEE,
          createdAt: order.createdAt,
          items: order.items.map((item) => ({
            productName: item.productName,
            color: item.color,
            size: item.size,
            quantity: item.quantity,
            price: item.price,
            subtotal: item.subtotal,
          })),
          addressLine1: orderAddress?.addressLine1 || '',
          addressLine2: orderAddress?.addressLine2 || '',
          city: orderAddress?.city || '',
          state: orderAddress?.state || '',
          postalCode: orderAddress?.postalCode || '',
          country: orderAddress?.country || '',
          phone: orderAddress?.phone || address.phone || '',
          trackingUrl: `${process.env.CLIENT_URL || 'http://localhost:3000'}/track-order/${order.trackingToken}`,
        }
      );
    } catch (emailError) {
      console.error('Error sending order confirmation email:', emailError);
    }
  }

  try {
    await notificationService.notifyNewOrder(order.id, {
      orderNumber: order.orderNumber,
      customerName: address.name,
      total: order.totalAmount,
    });
  } catch (notificationError) {
    console.error('Error sending admin notification:', notificationError);
  }

  await notifyLowStockForItems(mockItems, 'Error sending low stock notification for guest order');

  return {
    orderId: order.id,
    orderNumber: order.orderNumber,
    trackingToken: order.trackingToken,
    totalAmount: order.totalAmount,
    shippingFee: SHIPPING_FEE,
    status: order.status,
    paymentStatus: order.paymentStatus,
    paymentMethod: order.paymentMethod,
    items: order.items,
    ...(razorpayOrderDetails && {
      razorpayOrderId: razorpayOrderDetails.razorpayOrderId,
      razorpayAmount: razorpayOrderDetails.amount,
      razorpayCurrency: razorpayOrderDetails.currency,
    }),
    ...(order.paymentMethod === 'COD' && {
      message: 'Order created successfully. Payment to be collected on delivery.',
    }),
  };
};

const getCustomerOrders = async (userId, filters = {}) => {
  const { status, skip = 0, take = 10 } = filters;

  const where = { userId };
  if (status) where.status = status;

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: {
        items: { include: { variant: { include: { product: true } } } },
        shipments: true,
        payments: true
      },
      skip: parseInt(skip),
      take: parseInt(take),
      orderBy: { createdAt: 'desc' }
    }),
    prisma.order.count({ where })
  ]);

  return {
    orders: orders.map(order => ({
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      paymentStatus: order.paymentStatus,
      totalAmount: order.totalAmount,
      itemCount: order.items.length,
      createdAt: order.createdAt,
      shipmentStatus: order.shipments[0]?.status || 'PENDING'
    })),
    pagination: {
      total,
      skip: parseInt(skip),
      take: parseInt(take),
      pages: Math.ceil(total / take)
    }
  };
};

const getCustomerOrderDetail = async (userId, orderId) => {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: { include: { variant: { include: { product: true } } } },
      shipments: true,
      payments: true
    }
  });

  if (!order || order.userId !== userId) {
    throw new Error('Order not found or unauthorized');
  }

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    trackingToken: order.trackingToken,
    paymentStatus: order.paymentStatus,
    paymentMethod: order.paymentMethod,
    totalAmount: order.totalAmount,
    createdAt: order.createdAt,
    items: order.items.map(item => ({
      id: item.id,
      productName: item.productName,
      color: item.color,
      size: item.size,
      quantity: item.quantity,
      price: item.price,
      subtotal: item.subtotal,
      productImage: item.variant?.product?.variants?.[0]?.images?.[0]?.url
    })),
    shipment: order.shipments[0] ? {
      status: order.shipments[0].status,
      courierName: order.shipments[0].courierName,
      trackingNumber: order.shipments[0].trackingNumber,
      trackingUrl: order.shipments[0].trackingUrl,
      shippedAt: order.shipments[0].shippedAt
    } : null,
    payments: order.payments.map(p => ({
      gateway: p.gateway,
      status: p.status,
      amount: p.amount,
      paidAt: p.paidAt
    }))
  };
};

const trackOrder = async (userId, orderId) => {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: true,
      shipments: true
    }
  });

  if (!order || order.userId !== userId) {
    throw new Error('Order not found or unauthorized');
  }

  const shipment = order.shipments[0];

  return {
    orderNumber: order.orderNumber,
    status: order.status,
    shipmentStatus: shipment?.status || 'PENDING',
    shipmentDetails: shipment ? {
      courierName: shipment.courierName,
      trackingNumber: shipment.trackingNumber,
      trackingUrl: shipment.trackingUrl,
      shippedAt: shipment.shippedAt,
      estimatedDelivery: shipment.shippedAt ? new Date(new Date(shipment.shippedAt).getTime() + 5 * 24 * 60 * 60 * 1000) : null
    } : null,
    itemCount: order.items.length,
    totalAmount: order.totalAmount,
    createdAt: order.createdAt
  };
};

const cancelCustomerOrder = async (userId, orderId, reason = '') => {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true }
  });

  if (!order || order.userId !== userId) {
    throw new Error('Order not found or unauthorized');
  }

  if (order.status === 'DELIVERED') {
    throw new Error('Cannot cancel a delivered order. Contact support for return/refund.');
  }

  if (order.status === 'CANCELLED') {
    throw new Error('Order is already cancelled');
  }

  if (order.status === 'SHIPPED') {
    throw new Error('Cannot cancel a shipped order. Contact support for return/refund.');
  }

  // Cancel the order
  const cancelledOrder = await prisma.$transaction(async (tx) => {
    const updated = await tx.order.update({
      where: { id: orderId },
      data: {
        status: 'CANCELLED',
        paymentStatus: 'FAILED'
      },
      include: { items: true }
    });

    // Release inventory holds
    for (const item of updated.items) {
      await tx.inventoryLog.create({
        data: {
          variantId: item.variantId,
          orderId,
          type: 'RELEASE',
          quantity: item.quantity,
          note: `Order cancelled by customer. ${reason}`
        }
      });

      // Update Inventory table: decrement reserved
      await tx.inventory.update({
        where: { variantId: item.variantId },
        data: { reserved: { decrement: item.quantity } }
      });
    }

    return updated;
  });

  return {
    message: 'Order cancelled successfully',
    orderId: cancelledOrder.id,
    orderNumber: cancelledOrder.orderNumber,
    status: cancelledOrder.status
  };
};

// ======================== GUEST ORDER ENDPOINTS ========================

const createGuestOrder = async (sessionId, addressData, paymentMethod) => {
  const { name, phone, email, addressLine1, addressLine2, city, state, postalCode, country } = addressData;

  if (!name || !phone || !email || !addressLine1 || !city || !state || !postalCode || !country || !paymentMethod) {
    throw new Error('All address fields (including email) and payment method are required');
  }

  const normalizedPaymentMethod = normalizePaymentMethod(paymentMethod);

  const session = await prisma.guestSession.findUnique({
    where: { sessionId },
  });

  if (!session) {
    throw new Error('Session not found');
  }

  const sessionCart = await prisma.cart.findFirst({
    where: { sessionId: session.id, status: 'ACTIVE' },
    include: { items: { include: { variant: { include: { product: true } } } } },
  });

  if (!sessionCart || sessionCart.items.length === 0) {
    throw new Error('Cart is empty');
  }

  const cart = sessionCart;

  const totalAmount = cart.items.reduce((sum, item) => sum + (parseFloat(item.unitPrice) * item.quantity), 0);
  const orderNumber = generateOrderNumber();
  const trackingToken = crypto.randomBytes(16).toString('hex');

  const order = await prisma.$transaction(async (tx) => {
    const newOrder = await tx.order.create({
      data: {
        sessionId: session.id,
        orderNumber,
        trackingToken,
        status: getInitialOrderStatusForPaymentMethod(normalizedPaymentMethod),
        paymentStatus: 'PENDING',
        paymentMethod: normalizedPaymentMethod,
        totalAmount: parseFloat(totalAmount),
        items: {
          create: cart.items.map((item) => ({
            variantId: item.variantId,
            productName: item.variant.product.name,
            color: item.variant.color,
            size: item.variant.size,
            price: item.unitPrice,
            quantity: item.quantity,
            subtotal: parseFloat(item.unitPrice) * item.quantity,
          })),
        },
      },
      include: {
        items: { include: { variant: { include: { product: true } } } },
        payments: true,
        shipments: true,
      },
    });

    await tx.orderAddress.create({
      data: {
        orderId: newOrder.id,
        name,
        phone,
        email,
        addressLine1,
        addressLine2,
        city,
        state,
        postalCode,
        country,
      },
    });

    await tx.orderShipment.create({
      data: {
        orderId: newOrder.id,
        status: 'PENDING',
      },
    });

    await reserveInventoryForOrderTx(
      tx,
      newOrder.id,
      cart.items,
      'Guest order created, awaiting payment'
    );

    return newOrder;
  }, ORDER_TX_OPTIONS);

  let razorpayOrderDetails = null;
  let orderAddress = null;

  try {
    if (normalizedPaymentMethod === 'RAZORPAY') {
      try {
        razorpayOrderDetails = await razorpayService.createRazorpayOrder({
          orderId: order.id,
          amount: totalAmount,
          customerEmail: email,
          customerPhone: phone,
          customerName: name,
        });

        await prisma.order.update({
          where: { id: order.id },
          data: { razorpayOrderId: razorpayOrderDetails.razorpayOrderId },
        });
        await upsertPendingRazorpayPayment({
          orderId: order.id,
          razorpayOrderId: razorpayOrderDetails.razorpayOrderId,
          amount: totalAmount,
        });
      } catch (error) {
        console.error('Error creating Razorpay order:', error);
        await rollbackOrderForPaymentInitFailure(order.id, error.message);

        const paymentInitError = new Error(`Failed to initialize payment: ${error.message}`);
        paymentInitError.code = RAZORPAY_INIT_PENDING_ERROR_CODE;
        throw paymentInitError;
      }
    }

    orderAddress = await prisma.orderAddress.findFirst({
      where: { orderId: order.id },
    });
  } catch (error) {
    if (error?.code !== RAZORPAY_INIT_PENDING_ERROR_CODE) {
      await markOrderCreationFailed(order.id, error.message);
    }
    throw error;
  }

  await clearCheckedOutCartItems(cart.id, cart.items);

  try {
    await sendEmail(
      email,
      'Order Confirmation - ' + order.orderNumber,
      'order-confirmation',
      {
        customerName: name,
        orderId: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        paymentMethod: order.paymentMethod,
        totalAmount: order.totalAmount,
        createdAt: order.createdAt,
        items: order.items.map((item) => ({
          productName: item.productName,
          color: item.color,
          size: item.size,
          quantity: item.quantity,
          price: item.price,
          subtotal: item.subtotal,
        })),
        addressLine1: orderAddress?.addressLine1 || '',
        addressLine2: orderAddress?.addressLine2 || '',
        city: orderAddress?.city || '',
        state: orderAddress?.state || '',
        postalCode: orderAddress?.postalCode || '',
        country: orderAddress?.country || '',
        phone: orderAddress?.phone || phone || '',
        trackingUrl: `${process.env.CLIENT_URL || 'http://localhost:3000'}/orders/${order.id}`,
      }
    );
  } catch (emailError) {
    console.error('Error sending order confirmation email:', emailError);
  }

  try {
    await notificationService.notifyNewOrder(order.id, {
      orderNumber: order.orderNumber,
      customerName: name,
      total: order.totalAmount,
    });
  } catch (notificationError) {
    console.error('Error sending admin notification:', notificationError);
  }

  await notifyLowStockForItems(cart.items, 'Error sending low stock notification for guest order');

  return {
    orderId: order.id,
    orderNumber: order.orderNumber,
    totalAmount: order.totalAmount,
    status: order.status,
    paymentStatus: order.paymentStatus,
    paymentMethod: order.paymentMethod,
    items: order.items,
    // Return Razorpay details if applicable
    ...(razorpayOrderDetails && {
      razorpayOrderId: razorpayOrderDetails.razorpayOrderId,
      razorpayAmount: razorpayOrderDetails.amount,
      razorpayCurrency: razorpayOrderDetails.currency,
    }),
    ...(order.paymentMethod === 'COD' && {
      message: 'Order created successfully. Payment to be collected on delivery.',
    }),
  };
};

const getGuestOrderDetail = async (sessionId, orderId) => {
  const session = await prisma.guestSession.findUnique({
    where: { sessionId }
  });

  if (!session) {
    throw new Error('Session not found');
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: { include: { variant: { include: { product: true } } } },
      shipments: true,
      payments: true,
      orderAddress: true
    }
  });

  if (!order || order.userId !== null || order.sessionId !== session.id) {
    throw new Error('Order not found');
  }

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    paymentStatus: order.paymentStatus,
    paymentMethod: order.paymentMethod,
    totalAmount: order.totalAmount,
    createdAt: order.createdAt,
    items: order.items.map(item => ({
      id: item.id,
      productName: item.productName,
      color: item.color,
      size: item.size,
      quantity: item.quantity,
      price: item.price,
      subtotal: item.subtotal,
      productImage: item.variant?.product?.variants?.[0]?.images?.[0]?.url
    })),
    address: order.orderAddress,
    shipment: order.shipments[0] ? {
      status: order.shipments[0].status,
      courierName: order.shipments[0].courierName,
      trackingNumber: order.shipments[0].trackingNumber,
      trackingUrl: order.shipments[0].trackingUrl,
      shippedAt: order.shipments[0].shippedAt
    } : null,
    payments: order.payments.map(p => ({
      gateway: p.gateway,
      status: p.status,
      amount: p.amount,
      paidAt: p.paidAt
    }))
  };
};

const trackGuestOrder = async (sessionId, orderId) => {
  const session = await prisma.guestSession.findUnique({
    where: { sessionId }
  });

  if (!session) {
    throw new Error('Session not found');
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: true,
      shipments: true
    }
  });

  if (!order || order.userId !== null || order.sessionId !== session.id) {
    throw new Error('Order not found');
  }

  const shipment = order.shipments[0];

  return {
    orderNumber: order.orderNumber,
    status: order.status,
    shipmentStatus: shipment?.status || 'PENDING',
    shipmentDetails: shipment ? {
      courierName: shipment.courierName,
      trackingNumber: shipment.trackingNumber,
      trackingUrl: shipment.trackingUrl,
      shippedAt: shipment.shippedAt,
      estimatedDelivery: shipment.shippedAt ? new Date(new Date(shipment.shippedAt).getTime() + 5 * 24 * 60 * 60 * 1000) : null
    } : null,
    itemCount: order.items.length,
    totalAmount: order.totalAmount,
    createdAt: order.createdAt
  };
};

module.exports = {
  getOrderByTrackingToken,
  // Cancellation
  cancelOrder,
  // Items
  getOrderItems,
  // Customer-facing endpoints
  createOrderFromCart,
  createOrderFromCartAsGuest,
  createDirectOrder,
  createDirectOrderAsGuest,
  getCustomerOrders,
  getCustomerOrderDetail,
  trackOrder,
  cancelCustomerOrder,
  // Guest order endpoints
  createGuestOrder,
  getGuestOrderDetail,
  trackGuestOrder
};
