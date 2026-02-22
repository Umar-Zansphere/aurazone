const express = require('express');

const { verifyAdmin } = require('../middleware/admin.middleware');
const { uploadInMemory } = require('../services/s3.services');
const {
  getDashboard,
  listOrders,
  getOrderById,
  updateOrderStatus,
  updateOrderPaymentStatus,
  updateOrderShipment,
  deleteOrder,
  listProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  createVariant,
  updateVariant,
  deleteVariant,
  getInventory,
  getInventoryByVariantId,
  updateVariantInventory,
  createVariantImage,
  updateImage,
  deleteImage,
  createProduct,
  getAnalytics,
  getNotificationHistory,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  subscribeNotifications,
  unsubscribeNotifications,
  getNotificationPreferences,
  updateNotificationPreferences,
  broadcastNotification,
} = require('../controllers/admin.controller');

const router = express.Router();

router.use(verifyAdmin);

router.get('/dashboard', getDashboard);

router.get('/orders', listOrders);
router.get('/orders/:orderId', getOrderById);
router.put('/orders/:orderId/status', updateOrderStatus);
router.put('/orders/:orderId/payment-status', updateOrderPaymentStatus);
router.put('/orders/:orderId/shipment', updateOrderShipment);
router.delete('/orders/:orderId', deleteOrder);

router.get('/products', listProducts);
router.post('/products', uploadInMemory.any(), createProduct);
router.get('/products/:productId', getProductById);
router.put('/products/:productId', updateProduct);
router.delete('/products/:productId', deleteProduct);
router.post('/products/:productId/variants', createVariant);

router.put('/variants/:variantId', updateVariant);
router.delete('/variants/:variantId', deleteVariant);
router.get('/inventory', getInventory);
router.get('/inventory/:variantId', getInventoryByVariantId);
router.put('/variants/:variantId/inventory', updateVariantInventory);
router.post('/variants/:variantId/images', uploadInMemory.single('image'), createVariantImage);

router.put('/images/:imageId', updateImage);
router.delete('/images/:imageId', deleteImage);

router.get('/analytics', getAnalytics);

router.get('/notifications/history', getNotificationHistory);
router.put('/notifications/read-all', markAllNotificationsAsRead);
router.put('/notifications/:notificationId/read', markNotificationAsRead);
router.post('/notifications/subscribe', subscribeNotifications);
router.delete('/notifications/unsubscribe', unsubscribeNotifications);
router.get('/notifications/preferences', getNotificationPreferences);
router.put('/notifications/preferences', updateNotificationPreferences);
router.post('/notifications/broadcast', broadcastNotification);

module.exports = router;
