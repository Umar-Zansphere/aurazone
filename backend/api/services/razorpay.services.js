const Razorpay = require('razorpay');
const crypto = require('crypto');
const prisma = require('../../config/prisma');

// Initialize Razorpay instance
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const parseBooleanEnv = (value) => {
  if (typeof value !== 'string') {
    return false;
  }

  const normalized = value.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
};

const RAZORPAY_WEBHOOK_DEBUG_ENABLED = parseBooleanEnv(process.env.RAZORPAY_WEBHOOK_DEBUG);
const RAZORPAY_WEBHOOK_DEBUG_UNTIL = process.env.RAZORPAY_WEBHOOK_DEBUG_UNTIL;

const isWebhookDebugLoggingEnabled = () => {
  if (!RAZORPAY_WEBHOOK_DEBUG_ENABLED) {
    return false;
  }

  if (!RAZORPAY_WEBHOOK_DEBUG_UNTIL) {
    return true;
  }

  const until = new Date(RAZORPAY_WEBHOOK_DEBUG_UNTIL);
  if (Number.isNaN(until.getTime())) {
    return true;
  }

  return Date.now() <= until.getTime();
};

const getWebhookEntity = (payloadNode) => {
  if (!payloadNode) {
    return null;
  }

  return payloadNode.entity || payloadNode;
};

const buildWebhookDebugSummary = (event, payload) => {
  const payment = getWebhookEntity(payload?.payment);
  const order = getWebhookEntity(payload?.order);
  const refund = getWebhookEntity(payload?.refund);

  return {
    event,
    receivedAt: new Date().toISOString(),
    payment: payment
      ? {
        id: payment.id || null,
        orderId: payment.order_id || payment.orderId || null,
        amount: typeof payment.amount === 'number' ? payment.amount : null,
        currency: payment.currency || null,
        status: payment.status || null,
        method: payment.method || null,
        createdAtEpoch: payment.created_at || null,
        noteOrderId: payment.notes?.orderId || payment.notes?.order_id || null,
      }
      : null,
    order: order
      ? {
        id: order.id || null,
        amountPaid: typeof order.amount_paid === 'number' ? order.amount_paid : null,
        amountDue: typeof order.amount_due === 'number' ? order.amount_due : null,
        currency: order.currency || null,
        status: order.status || null,
        receipt: order.receipt || null,
        noteOrderId: order.notes?.orderId || order.notes?.order_id || null,
      }
      : null,
    refund: refund
      ? {
        id: refund.id || null,
        paymentId: refund.payment_id || null,
        amount: typeof refund.amount === 'number' ? refund.amount : null,
        status: refund.status || null,
        createdAtEpoch: refund.created_at || null,
      }
      : null,
  };
};

const logWebhookDebug = (stage, event, payload, extra = {}) => {
  if (!isWebhookDebugLoggingEnabled()) {
    return;
  }

  const summary = buildWebhookDebugSummary(event, payload);
  console.info('[Razorpay webhook debug]', {
    stage,
    ...summary,
    ...extra,
  });
};

// ======================== CREATE RAZORPAY ORDER ========================

const createRazorpayOrder = async (orderData) => {
  const { orderId, amount, customerEmail, customerPhone, customerName } = orderData;

  try {
    const razorpayOrder = await razorpay.orders.create({
      amount: Math.round(amount * 100), // Convert to paise (smallest unit)
      currency: 'INR',
      receipt: orderId,
      // customer_notify: 1,
      notes: {
        orderId: orderId,
      },
    });

    console.log('Razorpay order created:', razorpayOrder.id);

    return {
      razorpayOrderId: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      status: razorpayOrder.status,
    };
  } catch (error) {
    console.error('Error creating Razorpay order:', error);
    throw new Error(`Failed to create payment order: ${error.message}`);
  }
};

// ======================== VERIFY RAZORPAY PAYMENT ========================

const verifyPaymentSignature = async (paymentData) => {
  const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = paymentData;

  try {
    // Create HMAC-SHA256 signature
    const body = razorpayOrderId + '|' + razorpayPaymentId;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest('hex');

    const isValidSignature = expectedSignature === razorpaySignature;

    if (!isValidSignature) {
      throw new Error('Invalid payment signature');
    }

    console.log('Payment signature verified successfully');
    return {
      isValid: true,
      razorpayOrderId,
      razorpayPaymentId,
    };
  } catch (error) {
    console.error('Error verifying payment signature:', error);
    throw new Error(`Payment verification failed: ${error.message}`);
  }
};

// ======================== FETCH PAYMENT DETAILS ========================

const getPaymentDetails = async (razorpayPaymentId) => {
  try {
    const payment = await razorpay.payments.fetch(razorpayPaymentId);

    return {
      id: payment.id,
      orderId: payment.order_id,
      amount: payment.amount / 100, // Convert from paise to rupees
      currency: payment.currency,
      status: payment.status, // authorized, captured, failed, etc.
      method: payment.method,
      email: payment.email,
      contact: payment.contact,
      fee: payment.fee ? payment.fee / 100 : 0,
      tax: payment.tax ? payment.tax / 100 : 0,
      description: payment.description,
      createdAt: new Date(payment.created_at * 1000),
    };
  } catch (error) {
    console.error('Error fetching payment details:', error);
    throw new Error(`Failed to fetch payment details: ${error.message}`);
  }
};

// ======================== CAPTURE PAYMENT ========================

const capturePayment = async (razorpayPaymentId, amount) => {
  try {
    const payment = await razorpay.payments.capture(razorpayPaymentId, Math.round(amount * 100));

    console.log('Payment captured:', payment.id);

    return {
      id: payment.id,
      status: payment.status,
      amount: payment.amount / 100,
    };
  } catch (error) {
    console.error('Error capturing payment:', error);
    throw new Error(`Failed to capture payment: ${error.message}`);
  }
};

// ======================== REFUND PAYMENT ========================

const refundPayment = async (razorpayPaymentId, amount, reason = '') => {
  try {
    const refund = await razorpay.payments.refund(razorpayPaymentId, {
      amount: Math.round(amount * 100), // Full or partial refund
      notes: {
        reason: reason || 'Order cancellation',
      },
    });

    console.log('Refund created:', refund.id);

    return {
      refundId: refund.id,
      paymentId: razorpayPaymentId,
      amount: refund.amount / 100,
      status: refund.status,
      createdAt: new Date(refund.created_at * 1000),
    };
  } catch (error) {
    console.error('Error refunding payment:', error);
    throw new Error(`Failed to refund payment: ${error.message}`);
  }
};

// ======================== PROCESS PAYMENT WEBHOOK ========================

const processPaymentWebhook = async (webhookData) => {
  const { event, payload } = webhookData;

  try {
    logWebhookDebug('received', event, payload);

    let result;
    switch (event) {
      case 'payment.authorized':
        result = await handlePaymentAuthorized(payload);
        break;

      case 'payment.failed':
        result = await handlePaymentFailed(payload);
        break;

      case 'payment.captured':
        result = await handlePaymentCaptured(payload);
        break;

      case 'order.paid':
        result = await handleOrderPaid(payload);
        break;

      case 'refund.created':
        result = await handleRefundCreated(payload);
        break;

      case 'refund.processed':
        result = await handleRefundProcessed(payload);
        break;

      default:
        console.log('Unhandled webhook event:', event);
        result = { message: 'Webhook received but not processed' };
        break;
    }

    logWebhookDebug('processed', event, payload, {
      result: {
        success: result?.success ?? null,
        message: result?.message || null,
        orderNumber: result?.orderNumber || null,
        refundId: result?.refundId || null,
      },
    });

    return result;
  } catch (error) {
    logWebhookDebug('error', event, payload, {
      errorMessage: error?.message || 'Unknown webhook processing error',
    });
    console.error('Error processing webhook:', error);
    throw error;
  }
};

// ======================== WEBHOOK HANDLERS ========================

const normalizeNonEmptyString = (value) => {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed || undefined;
};

const extractPaymentWebhookData = (payload) => {
  const payment = getWebhookEntity(payload?.payment);
  if (!payment) {
    throw new Error('Webhook payload is missing payment entity');
  }

  const razorpayPaymentId = normalizeNonEmptyString(payment.id);
  if (!razorpayPaymentId) {
    throw new Error('Webhook payload is missing Razorpay payment id');
  }

  return {
    payment,
    razorpayPaymentId,
    razorpayOrderId: normalizeNonEmptyString(payment.order_id || payment.orderId),
    localOrderId: normalizeNonEmptyString(payment.notes?.orderId || payment.notes?.order_id),
  };
};

const findOrderForWebhook = async ({ razorpayOrderId, razorpayPaymentId, localOrderId }) => {
  if (razorpayOrderId) {
    const byRazorpayOrderId = await prisma.order.findUnique({
      where: { razorpayOrderId },
      include: { items: true },
    });
    if (byRazorpayOrderId) {
      return byRazorpayOrderId;
    }
  }

  if (razorpayPaymentId) {
    const byRazorpayPaymentId = await prisma.order.findUnique({
      where: { razorpayPaymentId },
      include: { items: true },
    });
    if (byRazorpayPaymentId) {
      return byRazorpayPaymentId;
    }
  }

  if (localOrderId) {
    const byLocalOrderId = await prisma.order.findUnique({
      where: { id: localOrderId },
      include: { items: true },
    });
    if (byLocalOrderId) {
      return byLocalOrderId;
    }
  }

  return null;
};

const upsertRazorpayPaymentTx = async (tx, {
  orderId,
  razorpayOrderId,
  razorpayPaymentId,
  amount,
  status,
  paidAt = null,
}) => {
  const uniqueIdentifier = razorpayOrderId || razorpayPaymentId;
  if (!uniqueIdentifier) {
    throw new Error('Cannot upsert Razorpay payment without order id or payment id');
  }

  const idempotencyKey = `rzp-webhook-${uniqueIdentifier}`;

  const where = razorpayOrderId
    ? {
      gateway_gatewayOrderId: {
        gateway: 'RAZORPAY',
        gatewayOrderId: razorpayOrderId,
      },
    }
    : {
      gateway_gatewayPaymentId: {
        gateway: 'RAZORPAY',
        gatewayPaymentId: razorpayPaymentId,
      },
    };

  return tx.payment.upsert({
    where,
    update: {
      orderId,
      ...(razorpayOrderId ? { gatewayOrderId: razorpayOrderId } : {}),
      ...(razorpayPaymentId ? { gatewayPaymentId: razorpayPaymentId } : {}),
      amount,
      status,
      paidAt,
      idempotencyKey,
    },
    create: {
      orderId,
      gateway: 'RAZORPAY',
      ...(razorpayOrderId ? { gatewayOrderId: razorpayOrderId } : {}),
      ...(razorpayPaymentId ? { gatewayPaymentId: razorpayPaymentId } : {}),
      amount,
      status,
      paidAt,
      idempotencyKey,
    },
  });
};

const markOrderAsPaidFromWebhook = async ({
  razorpayOrderId,
  razorpayPaymentId,
  localOrderId,
  amount,
  paidAt,
  soldNote,
}) => {
  const order = await findOrderForWebhook({
    razorpayOrderId,
    razorpayPaymentId,
    localOrderId,
  });

  if (!order) {
    throw new Error(
      `Order not found for webhook payload (razorpayOrderId=${razorpayOrderId || 'n/a'}, razorpayPaymentId=${razorpayPaymentId || 'n/a'}, localOrderId=${localOrderId || 'n/a'})`
    );
  }

  if (order.paymentStatus === 'SUCCESS') {
    return order;
  }

  await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: order.id },
      data: {
        razorpayPaymentId,
        paymentStatus: 'SUCCESS',
        status: 'SUCCESS',
      },
    });

    await upsertRazorpayPaymentTx(tx, {
      orderId: order.id,
      razorpayOrderId,
      razorpayPaymentId,
      amount,
      status: 'SUCCESS',
      paidAt,
    });

    for (const item of order.items) {
      const inventory = await tx.inventory.findUnique({
        where: { variantId: item.variantId },
      });

      if (!inventory) {
        continue;
      }

      if (inventory.quantity < item.quantity) {
        throw new Error(`Insufficient inventory for variant ${item.variantId} while finalizing payment`);
      }

      const reservedToDecrement = Math.min(item.quantity, inventory.reserved);
      await tx.inventory.update({
        where: { id: inventory.id },
        data: {
          quantity: { decrement: item.quantity },
          reserved: { decrement: reservedToDecrement },
        },
      });

      await tx.inventoryLog.create({
        data: {
          variantId: item.variantId,
          orderId: order.id,
          type: 'SOLD',
          quantity: item.quantity,
          note: soldNote,
        },
      });
    }
  });

  return order;
};

const handlePaymentAuthorized = async (payload) => {
  const {
    payment,
    razorpayPaymentId,
    razorpayOrderId,
    localOrderId,
  } = extractPaymentWebhookData(payload);

  try {
    const order = await markOrderAsPaidFromWebhook({
      razorpayOrderId,
      razorpayPaymentId,
      localOrderId,
      amount: payment.amount / 100,
      paidAt: new Date(payment.created_at * 1000),
      soldNote: 'Payment authorized successfully',
    });

    console.log('Payment authorized for order:', order.orderNumber);

    return {
      success: true,
      orderNumber: order.orderNumber,
      message: 'Payment authorized successfully',
    };
  } catch (error) {
    console.error('Error handling payment authorized:', error);
    throw error;
  }
};

const handlePaymentFailed = async (payload) => {
  const {
    payment,
    razorpayPaymentId,
    razorpayOrderId,
    localOrderId,
  } = extractPaymentWebhookData(payload);

  try {
    const order = await findOrderForWebhook({
      razorpayOrderId,
      razorpayPaymentId,
      localOrderId,
    });

    if (!order) {
      throw new Error(
        `Order not found for failed payment webhook (razorpayOrderId=${razorpayOrderId || 'n/a'}, razorpayPaymentId=${razorpayPaymentId || 'n/a'}, localOrderId=${localOrderId || 'n/a'})`
      );
    }

    if (order.paymentStatus === 'SUCCESS') {
      return {
        success: false,
        orderNumber: order.orderNumber,
        message: 'Payment failure ignored because order is already paid',
      };
    }

    await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: order.id },
        data: {
          paymentStatus: 'FAILED',
          status: 'FAILED',
          razorpayPaymentId,
        },
      });

      await upsertRazorpayPaymentTx(tx, {
        orderId: order.id,
        razorpayOrderId,
        razorpayPaymentId,
        amount: payment.amount / 100,
        status: 'FAILED',
        paidAt: null,
      });

      for (const item of order.items) {
        const inventory = await tx.inventory.findUnique({
          where: { variantId: item.variantId },
        });

        if (!inventory) {
          continue;
        }

        const releaseQuantity = Math.min(item.quantity, inventory.reserved);
        if (releaseQuantity <= 0) {
          continue;
        }

        await tx.inventory.update({
          where: { id: inventory.id },
          data: {
            reserved: { decrement: releaseQuantity },
          },
        });

        await tx.inventoryLog.create({
          data: {
            variantId: item.variantId,
            orderId: order.id,
            type: 'RELEASE',
            quantity: releaseQuantity,
            note: 'Payment failed',
          },
        });
      }
    });

    console.log('Payment failed for order:', order.orderNumber);

    return {
      success: false,
      orderNumber: order.orderNumber,
      message: 'Payment failed',
    };
  } catch (error) {
    console.error('Error handling payment failed:', error);
    throw error;
  }
};

const handlePaymentCaptured = async (payload) => {
  const {
    payment,
    razorpayPaymentId,
    razorpayOrderId,
    localOrderId,
  } = extractPaymentWebhookData(payload);

  try {
    const order = await markOrderAsPaidFromWebhook({
      razorpayOrderId,
      razorpayPaymentId,
      localOrderId,
      amount: payment.amount / 100,
      paidAt: new Date(payment.created_at * 1000),
      soldNote: 'Payment captured successfully',
    });

    console.log('Payment captured for order:', order.orderNumber);

    return {
      success: true,
      orderNumber: order.orderNumber,
      message: 'Payment captured successfully',
    };
  } catch (error) {
    console.error('Error handling payment captured:', error);
    throw error;
  }
};

const handleOrderPaid = async (payload) => {
  try {
    if (!getWebhookEntity(payload?.payment)) {
      console.log('order.paid webhook received without payment payload');
      return {
        success: true,
        message: 'Order paid webhook received without payment payload',
      };
    }

    const result = await handlePaymentCaptured(payload);
    return {
      ...result,
      message: 'Order paid processed successfully',
    };
  } catch (error) {
    console.error('Error handling order paid:', error);
    throw error;
  }
};

const handleRefundCreated = async (payload) => {
  const refund = getWebhookEntity(payload?.refund);

  try {
    if (!refund?.payment_id) {
      throw new Error('Webhook payload is missing refund.payment_id');
    }

    const payment = await prisma.payment.findUnique({
      where: {
        gateway_gatewayPaymentId: {
          gateway: 'RAZORPAY',
          gatewayPaymentId: refund.payment_id,
        },
      },
    });

    if (payment) {
      // Update order status to CANCELLED if full refund
      await prisma.order.update({
        where: { id: payment.orderId },
        data: { status: 'CANCELLED' },
      });
    }

    console.log('Refund created:', refund.id);

    return {
      success: true,
      refundId: refund.id,
      message: 'Refund initiated',
    };
  } catch (error) {
    console.error('Error handling refund created:', error);
    throw error;
  }
};

const handleRefundProcessed = async (payload) => {
  const refund = getWebhookEntity(payload?.refund);

  try {
    if (!refund?.id) {
      throw new Error('Webhook payload is missing refund id');
    }

    console.log('Refund processed:', refund.id);

    return {
      success: true,
      refundId: refund.id,
      message: 'Refund processed successfully',
    };
  } catch (error) {
    console.error('Error handling refund processed:', error);
    throw error;
  }
};

// ======================== VALIDATE WEBHOOK SIGNATURE ========================

const validateWebhookSignature = (body, signature) => {
  try {
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
      .update(body)
      .digest('hex');

    const isValid = expectedSignature === signature;

    if (!isValid) {
      throw new Error('Invalid webhook signature');
    }

    return true;
  } catch (error) {
    console.error('Error validating webhook signature:', error);
    return false;
  }
};

module.exports = {
  // Order creation
  createRazorpayOrder,
  // Payment verification
  verifyPaymentSignature,
  getPaymentDetails,
  capturePayment,
  refundPayment,
  // Webhooks
  processPaymentWebhook,
  validateWebhookSignature,
  // Handlers
  handlePaymentAuthorized,
  handlePaymentFailed,
  handlePaymentCaptured,
  handleOrderPaid,
  handleRefundCreated,
  handleRefundProcessed,
};
