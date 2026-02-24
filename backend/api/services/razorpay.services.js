const Razorpay = require('razorpay');
const crypto = require('crypto');
const prisma = require('../../config/prisma');

// Initialize Razorpay instance
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

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
    switch (event) {
      case 'payment.authorized':
        return await handlePaymentAuthorized(payload);

      case 'payment.failed':
        return await handlePaymentFailed(payload);

      case 'payment.captured':
        return await handlePaymentCaptured(payload);

      case 'refund.created':
        return await handleRefundCreated(payload);

      case 'refund.processed':
        return await handleRefundProcessed(payload);

      default:
        console.log('Unhandled webhook event:', event);
        return { message: 'Webhook received but not processed' };
    }
  } catch (error) {
    console.error('Error processing webhook:', error);
    throw error;
  }
};

// ======================== WEBHOOK HANDLERS ========================

const upsertRazorpayPaymentTx = async (tx, {
  orderId,
  razorpayOrderId,
  razorpayPaymentId,
  amount,
  status,
  paidAt = null,
}) => {
  const idempotencyKey = `rzp-webhook-${razorpayOrderId}`;

  return tx.payment.upsert({
    where: {
      gateway_gatewayOrderId: {
        gateway: 'RAZORPAY',
        gatewayOrderId: razorpayOrderId,
      },
    },
    update: {
      orderId,
      gatewayPaymentId: razorpayPaymentId,
      amount,
      status,
      paidAt,
      idempotencyKey,
    },
    create: {
      orderId,
      gateway: 'RAZORPAY',
      gatewayOrderId: razorpayOrderId,
      gatewayPaymentId: razorpayPaymentId,
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
  amount,
  paidAt,
  soldNote,
}) => {
  const order = await prisma.order.findUnique({
    where: { razorpayOrderId },
    include: { items: true },
  });

  if (!order) {
    throw new Error(`Order not found for razorpay order: ${razorpayOrderId}`);
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
  const { payment } = payload;
  const razorpayPaymentId = payment.id;
  const razorpayOrderId = payment.order_id;

  try {
    const order = await markOrderAsPaidFromWebhook({
      razorpayOrderId,
      razorpayPaymentId,
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
  const { payment } = payload;
  const razorpayPaymentId = payment.id;
  const razorpayOrderId = payment.order_id;

  try {
    const order = await prisma.order.findUnique({
      where: { razorpayOrderId },
      include: { items: true },
    });

    if (!order) {
      throw new Error(`Order not found for razorpay order: ${razorpayOrderId}`);
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
  const { payment } = payload;
  const razorpayPaymentId = payment.id;
  const razorpayOrderId = payment.order_id;

  try {
    const order = await markOrderAsPaidFromWebhook({
      razorpayOrderId,
      razorpayPaymentId,
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

const handleRefundCreated = async (payload) => {
  const { refund } = payload;

  try {
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
  const { refund } = payload;

  try {
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
  handleRefundCreated,
  handleRefundProcessed,
};
