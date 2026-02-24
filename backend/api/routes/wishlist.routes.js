const express = require('express');
const router = express.Router();
const cartController = require('../controllers/cart.controller');
const { optionalAuth, extractSession } = require('../middleware/auth.middleware');

// All wishlist routes support both authenticated users and guest sessions
router.use(optionalAuth);
router.use(extractSession);

// ======================== WISHLIST ROUTES ========================

// Get wishlist
router.get('/', cartController.getWishlist);

// Add to wishlist
router.post('/', cartController.addToWishlist);

// Remove from wishlist
router.delete('/:wishlistItemId', cartController.removeFromWishlist);

// Move wishlist item to cart
router.post('/:wishlistItemId/move-to-cart', cartController.moveToCart);

// Clear entire wishlist
router.delete('/', cartController.clearWishlist);

module.exports = router;
