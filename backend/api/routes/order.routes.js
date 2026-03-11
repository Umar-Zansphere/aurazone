const express = require('express');
const router = express.Router();
const orderController = require('../controllers/order.controller');
const { verifyToken, optionalAuth, manageGuestSession } = require('../middleware/auth.middleware');

// ======================== CUSTOMER ROUTES (Protected by auth middleware) ========================

// Create order from cart (checkout) - supports both authenticated and guest users
router.post('/', optionalAuth, manageGuestSession, orderController.createOrderFromCart);

// Create direct order (Buy Now) - supports both authenticated and guest users
router.post('/direct', optionalAuth, manageGuestSession, orderController.createDirectOrder);

// Get all orders for logged-in customer
router.get('/', verifyToken, orderController.getCustomerOrders);

// Get order detail for customer
router.get('/:orderId', verifyToken, orderController.getCustomerOrderDetail);

// Track order by tracking token (public - no auth required)
router.get('/track/:trackingToken', orderController.trackOrderByToken);

// Track order (customer)
router.get('/:orderId/track', verifyToken, orderController.trackOrder);

// Cancel order (customer can only cancel pending orders)
router.post('/:orderId/cancel', verifyToken, orderController.cancelCustomerOrder);

// ======================== PAYMENT ROUTES ========================

// Verify Razorpay payment
router.post('/payment/verify', orderController.verifyPayment);

// Razorpay webhook (no auth required - verified by signature)
router.post('/webhook/razorpay', orderController.razorpayWebhook);

module.exports = router;
