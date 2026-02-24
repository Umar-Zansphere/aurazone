const notificationService = require('../services/notification.service');
const prisma = require('../../config/prisma');

const getVapidKey = (req, res) => {
    const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
    if (!vapidPublicKey) {
        return res.status(500).json({ message: 'VAPID keys not configured' });
    }
    res.status(200).json({ publicKey: vapidPublicKey });
};


// Subscribe to push notifications
async function subscribe(req, res) {
    try {
        const subscription = req.body;

        if (!subscription || !subscription.endpoint || !subscription.keys) {
            return res.status(400).json({
                success: false,
                message: 'Invalid subscription data'
            });
        }

        // Get user ID from JWT token (if authenticated)
        const userId = req.user?.id || null;

        // Get session ID from cookies (for guest users)
        const sessionId = req.cookies?.sessionId || null;

        // Get user agent
        const userAgent = req.headers['user-agent'] || null;

        // Save subscription
        await notificationService.saveSubscription(
            subscription,
            userId,
            sessionId,
            userAgent
        );

        res.json({
            success: true,
            message: 'Successfully subscribed to notifications'
        });
    } catch (error) {
        console.error('Error in subscribe controller:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to subscribe to notifications',
            error: error.message
        });
    }
}

// Unsubscribe from push notifications
async function unsubscribe(req, res) {
    try {
        const { endpoint } = req.body;

        if (!endpoint) {
            return res.status(400).json({
                success: false,
                message: 'Endpoint is required'
            });
        }

        await notificationService.removeSubscription(endpoint);

        res.json({
            success: true,
            message: 'Successfully unsubscribed from notifications'
        });
    } catch (error) {
        console.error('Error in unsubscribe controller:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to unsubscribe from notifications',
            error: error.message
        });
    }
}

// Send notification to a specific user (admin only)
async function sendNotification(req, res) {
    try {
        const { userId, sessionId, notification } = req.body;

        if (!notification || !notification.title || !notification.body) {
            return res.status(400).json({
                success: false,
                message: 'Notification title and body are required'
            });
        }

        if (!userId && !sessionId) {
            return res.status(400).json({
                success: false,
                message: 'Either userId or sessionId is required'
            });
        }

        const payload = {
            title: notification.title,
            body: notification.body,
            icon: notification.icon || '/icons/manifest-icon-192.maskable.png',
            badge: notification.badge || '/icons/manifest-icon-192.maskable.png',
            url: notification.url || '/',
            data: notification.data || {}
        };

        let result;
        if (userId) {
            result = await notificationService.sendToUser(userId, payload);
        } else {
            result = await notificationService.sendToSession(sessionId, payload);
        }

        res.json(result);
    } catch (error) {
        console.error('Error in sendNotification controller:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to send notification',
            error: error.message
        });
    }
}

// Broadcast notification to all users (admin only)
async function broadcastNotification(req, res) {
    try {
        const { notification, filters } = req.body;

        if (!notification || !notification.title || !notification.body) {
            return res.status(400).json({
                success: false,
                message: 'Notification title and body are required'
            });
        }

        const payload = {
            title: notification.title,
            body: notification.body,
            icon: notification.icon || '/icons/manifest-icon-192.maskable.png',
            badge: notification.badge || '/icons/manifest-icon-192.maskable.png',
            url: notification.url || '/',
            data: notification.data || {}
        };

        const result = await notificationService.broadcastToAll(payload, filters || {});

        res.json(result);
    } catch (error) {
        console.error('Error in broadcastNotification controller:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to broadcast notification',
            error: error.message
        });
    }
}

// Get notification history for current admin (admin only)
async function getHistory(req, res) {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }

        const limit = parseInt(req.query.limit) || 20;
        const skip = parseInt(req.query.skip) || 0;

        const notifications = await prisma.notificationHistory.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            take: limit,
            skip: skip
        });

        res.json({ success: true, notifications });
    } catch (error) {
        console.error('Error in getHistory controller:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch notification history',
            error: error.message
        });
    }
}

// Get unread notification count (admin only)
async function getUnreadCount(req, res) {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }

        const count = await prisma.notificationHistory.count({
            where: {
                userId,
                isRead: false
            }
        });

        res.json({ success: true, count });
    } catch (error) {
        console.error('Error in getUnreadCount controller:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get unread count',
            error: error.message
        });
    }
}

// Mark notification as read (admin only)
async function markAsRead(req, res) {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }

        const { id } = req.params;

        await prisma.notificationHistory.updateMany({
            where: {
                id,
                userId // Ensure user can only mark their own notifications
            },
            data: { isRead: true }
        });

        res.json({ success: true });
    } catch (error) {
        console.error('Error in markAsRead controller:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to mark notification as read',
            error: error.message
        });
    }
}

// Get notification preferences (admin only)
async function getPreferences(req, res) {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }

        let preferences = await prisma.notificationPreferences.findUnique({
            where: { userId }
        });

        // Create default preferences if they don't exist
        if (!preferences) {
            preferences = await prisma.notificationPreferences.create({
                data: { userId }
            });
        }

        res.json({ success: true, preferences });
    } catch (error) {
        console.error('Error in getPreferences controller:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch preferences',
            error: error.message
        });
    }
}

// Update notification preferences (admin only)
async function updatePreferences(req, res) {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }

        const { newOrders, orderStatusChange, lowStock, otherEvents } = req.body;

        const preferences = await prisma.notificationPreferences.upsert({
            where: { userId },
            update: {
                newOrders,
                orderStatusChange,
                lowStock,
                otherEvents
            },
            create: {
                userId,
                newOrders,
                orderStatusChange,
                lowStock,
                otherEvents
            }
        });

        res.json({ success: true, preferences });
    } catch (error) {
        console.error('Error in updatePreferences controller:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update preferences',
            error: error.message
        });
    }
}

// Send test notification to self (admin only)
async function sendTestNotification(req, res) {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }

        const payload = {
            title: 'Test Notification',
            body: 'This is a test notification from SoleMate Admin',
            url: '/notifications',
            icon: '/icons/manifest-icon-192.maskable.png'
        };

        const result = await notificationService.sendToUser(userId, payload);

        // Save to history
        await prisma.notificationHistory.create({
            data: {
                userId,
                title: payload.title,
                body: payload.body,
                url: payload.url,
                icon: payload.icon
            }
        });

        res.json(result);
    } catch (error) {
        console.error('Error in sendTestNotification controller:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to send test notification',
            error: error.message
        });
    }
}

module.exports = {
    subscribe,
    unsubscribe,
    sendNotification,
    broadcastNotification,
    getHistory,
    getUnreadCount,
    markAsRead,
    getPreferences,
    updatePreferences,
    sendTestNotification,
    getVapidKey
};
