const express = require('express');
const router = express.Router();
const cartController = require('../controllers/cart.controller');
const { optionalAuth, manageGuestSession } = require('../middleware/auth.middleware');

// All cart routes support both authenticated users and guest sessions
router.use(optionalAuth);
router.use(manageGuestSession);

// ======================== CART ROUTES ========================

// Get cart
router.get('/', cartController.getCart);

// Get cart summary with totals
router.get('/summary', cartController.getCartSummary);

// Add to cart
router.post('/', cartController.addToCart);

// Update cart item quantity
router.patch('/:cartItemId', cartController.updateCartItem);

// Remove from cart
router.delete('/:cartItemId', cartController.removeFromCart);

// Clear entire cart
router.delete('/', cartController.clearCart);

module.exports = router;
