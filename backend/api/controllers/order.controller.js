const orderService = require('../services/order.services');
const razorpayService = require('../services/razorpay.services');

// ======================== CUSTOMER-FACING ORDER CONTROLLERS ========================

const createOrderFromCart = async (req, res, next) => {
  try {
    const userId = req.user?.id; // From auth middleware (optional)
    const sessionId = req.sessionId; // From manageGuestSession middleware
    const { addressId, address, paymentMethod } = req.body;

    // Authenticated user flow
    if (userId && addressId) {
      if (!paymentMethod) {
        return res.status(400).json({ message: 'Payment method is required' });
      }
      const result = await orderService.createOrderFromCart(userId, {
        addressId,
        paymentMethod
      });
      return res.status(201).json({
        success: true,
        data: result
      });
    }

    // Guest user flow
    if (!userId && sessionId && address) {
      if (!address.email || !address.phone) {
        return res.status(400).json({ message: 'Email and phone are required for guest checkout' });
      }
      if (!paymentMethod) {
        return res.status(400).json({ message: 'Payment method is required' });
      }

      const result = await orderService.createOrderFromCartAsGuest(sessionId, {
        address,
        paymentMethod,
      });
      return res.status(201).json({
        success: true,
        data: result
      });
    }

    return res.status(400).json({
      message: 'Invalid request. Provide either addressId (authenticated) or address + sessionId (guest)'
    });
  } catch (error) {
    next(error);
  }
};

const getCustomerOrders = async (req, res, next) => {
  try {
    const userId = req.user.id; // From auth middleware
    const { status, skip, take } = req.query;

    const result = await orderService.getCustomerOrders(userId, {
      status,
      skip,
      take
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

const getCustomerOrderDetail = async (req, res, next) => {
  try {
    const userId = req.user.id; // From auth middleware
    const { orderId } = req.params;

    if (!orderId) {
      return res.status(400).json({ message: 'Order ID is required' });
    }

    const order = await orderService.getCustomerOrderDetail(userId, orderId);

    res.json({
      success: true,
      data: order
    });
  } catch (error) {
    next(error);
  }
};

const trackOrder = async (req, res, next) => {
  try {
    const userId = req.user.id; // From auth middleware
    const { orderId } = req.params;

    if (!orderId) {
      return res.status(400).json({ message: 'Order ID is required' });
    }

    const tracking = await orderService.trackOrder(userId, orderId);

    res.json({
      success: true,
      data: tracking
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Track order by tracking token (public endpoint - no authentication required)
 * Used for guest users or email-based tracking links
 */
const trackOrderByToken = async (req, res, next) => {
  try {
    const { trackingToken } = req.params;

    if (!trackingToken) {
      return res.status(400).json({ message: 'Tracking token is required' });
    }

    const order = await orderService.getOrderByTrackingToken(trackingToken);

    res.json({
      success: true,
      data: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        paymentStatus: order.paymentStatus,
        totalAmount: order.totalAmount,
        createdAt: order.createdAt,
        items: order.items,
        shipments: order.shipments,
        orderAddress: order.orderAddress
      }
    });
  } catch (error) {
    next(error);
  }
};

const cancelCustomerOrder = async (req, res, next) => {
  try {
    const userId = req.user.id; // From auth middleware
    const { orderId } = req.params;
    const { reason } = req.body;

    if (!orderId) {
      return res.status(400).json({ message: 'Order ID is required' });
    }

    const result = await orderService.cancelCustomerOrder(userId, orderId, reason);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

// ======================== PAYMENT CONTROLLERS ========================

const verifyPayment = async (req, res, next) => {
  try {
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;

    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return res.status(400).json({
        success: false,
        message: 'Missing payment verification parameters'
      });
    }

    // Verify payment signature
    const verification = await razorpayService.verifyPaymentSignature({
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature
    });

    if (!verification.isValid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment signature'
      });
    }

    // Get payment details from Razorpay
    const paymentDetails = await razorpayService.getPaymentDetails(razorpayPaymentId);

    // Verify payment status
    if (paymentDetails.status !== 'authorized' && paymentDetails.status !== 'captured') {
      return res.status(400).json({
        success: false,
        message: 'Payment not authorized',
        paymentStatus: paymentDetails.status
      });
    }

    // If payment is authorized, capture it
    if (paymentDetails.status === 'authorized') {
      await razorpayService.capturePayment(razorpayPaymentId, paymentDetails.amount);
    }

    res.json({
      success: true,
      message: 'Payment verified and processed successfully',
      data: {
        razorpayOrderId,
        razorpayPaymentId,
        amount: paymentDetails.amount,
        status: 'captured'
      }
    });
  } catch (error) {
    console.error('Payment verification error:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Payment verification failed'
    });
  }
};

const razorpayWebhook = async (req, res, next) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const body = req.body;

    // Validate webhook signature
    const rawBody = JSON.stringify(body);
    const isValidSignature = razorpayService.validateWebhookSignature(rawBody, signature);

    if (!isValidSignature) {
      console.error('Invalid webhook signature');
      return res.status(400).json({
        success: false,
        message: 'Invalid webhook signature'
      });
    }

    // Process webhook
    const event = body.event;
    const payload = body.payload;

    console.log('Processing webhook event:', event);

    const result = await razorpayService.processPaymentWebhook({
      event,
      payload
    });

    res.json({
      success: true,
      message: 'Webhook processed',
      data: result
    });
  } catch (error) {
    console.error('Webhook processing error:', error);
    // Still return 200 to Razorpay so it doesn't retry
    res.status(200).json({
      success: false,
      message: error.message || 'Webhook processing failed'
    });
  }
};

module.exports = {
  // Customer-facing endpoints
  createOrderFromCart,
  getCustomerOrders,
  getCustomerOrderDetail,
  trackOrder,
  trackOrderByToken,
  cancelCustomerOrder,
  // Payment endpoints
  verifyPayment,
  razorpayWebhook
};
