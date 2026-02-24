const router = require('express').Router();
const notificationsController = require('../controllers/notifications.controller');
const { verifyToken, verifyAdmin } = require('../middleware/admin.middleware');

// Public routes
router.get('/vapid-key', notificationsController.getVapidKey);
router.post('/subscribe', verifyToken, notificationsController.subscribe);
router.delete('/unsubscribe',verifyToken, notificationsController.unsubscribe);

// Admin routes - require authentication
router.get('/history', verifyAdmin, notificationsController.getHistory);
router.get('/unread-count', verifyAdmin, notificationsController.getUnreadCount);
router.patch('/:id/read', verifyAdmin, notificationsController.markAsRead);
router.get('/preferences', verifyAdmin, notificationsController.getPreferences);
router.post('/preferences', verifyAdmin, notificationsController.updatePreferences);
router.post('/test', verifyAdmin, notificationsController.sendTestNotification);

// Admin-only send routes
router.post('/send', verifyAdmin, notificationsController.sendNotification);
router.post('/broadcast', verifyAdmin, notificationsController.broadcastNotification);

module.exports = router;
