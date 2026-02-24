const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const { verifyToken } = require('../middleware/auth.middleware');

// All user routes require authentication
router.use(verifyToken);

// Profile endpoints
router.get('/profile', userController.getProfile);
router.put('/profile', userController.updateProfile);
router.put('/phone', userController.updatePhoneNumber);

// Address endpoints
router.get('/addresses', userController.getAddresses);
router.get('/addresses/:addressId', userController.getAddressById);
router.post('/addresses', userController.createAddress);
router.put('/addresses/:addressId', userController.updateAddress);
router.delete('/addresses/:addressId', userController.deleteAddress);
router.patch('/addresses/:addressId/default', userController.setDefaultAddress);

module.exports = router;
