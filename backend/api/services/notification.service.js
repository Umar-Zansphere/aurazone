const webPush = require('web-push');
const prisma = require('../../config/prisma');

// Initialize web-push with VAPID keys
function initializeWebPush() {
    const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
    const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
    const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:admin@solemate.com';

    if (!vapidPublicKey || !vapidPrivateKey) {
        console.warn('⚠️  VAPID keys not configured. Push notifications will not work.');
        console.warn('Generate keys with: npx web-push generate-vapid-keys');
        return false;
    }

    webPush.setVapidDetails(
        vapidSubject,
        vapidPublicKey,
        vapidPrivateKey
    );

    console.log('✅ Web Push initialized with VAPID keys');
    return true;
}

// Send push notification to a single subscription
async function sendPushNotification(subscription, payload) {
    try {
        const pushSubscription = {
            endpoint: subscription.endpoint,
            keys: {
                p256dh: subscription.p256dh,
                auth: subscription.auth
            }
        };

        const payloadString = JSON.stringify(payload);

        await webPush.sendNotification(pushSubscription, payloadString);
        return { success: true, endpoint: subscription.endpoint };
    } catch (error) {
        console.error('Error sending push notification:', error);

        // Handle expired or invalid subscriptions
        if (error.statusCode === 404 || error.statusCode === 410) {
            console.log('Subscription expired or invalid, removing from database:', subscription.endpoint);
            await prisma.pushSubscription.delete({
                where: { endpoint: subscription.endpoint }
            }).catch(err => console.error('Error deleting subscription:', err));
        }

        return {
            success: false,
            endpoint: subscription.endpoint,
            error: error.message
        };
    }
}

// Send notification to all devices of a specific user
async function sendToUser(userId, payload) {
    try {
        const subscriptions = await prisma.pushSubscription.findMany({
            where: { userId }
        });

        if (subscriptions.length === 0) {
            return { success: false, message: 'No subscriptions found for user' };
        }

        const results = await Promise.all(
            subscriptions.map(sub => sendPushNotification(sub, payload))
        );

        const sent = results.filter(r => r.success).length;
        const failed = results.filter(r => !r.success).length;

        return {
            success: true,
            sent,
            failed,
            total: subscriptions.length,
            results
        };
    } catch (error) {
        console.error('Error sending to user:', error);
        throw error;
    }
}

// Send notification to all devices of a guest session
async function sendToSession(sessionId, payload) {
    try {
        const subscriptions = await prisma.pushSubscription.findMany({
            where: { sessionId }
        });

        if (subscriptions.length === 0) {
            return { success: false, message: 'No subscriptions found for session' };
        }

        const results = await Promise.all(
            subscriptions.map(sub => sendPushNotification(sub, payload))
        );

        const sent = results.filter(r => r.success).length;
        const failed = results.filter(r => !r.success).length;

        return {
            success: true,
            sent,
            failed,
            total: subscriptions.length,
            results
        };
    } catch (error) {
        console.error('Error sending to session:', error);
        throw error;
    }
}

// Broadcast notification to all subscribed users
async function broadcastToAll(payload, filters = {}) {
    try {
        const where = {};

        // Apply filters
        if (filters.onlyVerified) {
            where.user = {
                is_email_verified: { not: null }
            };
        }

        if (filters.onlyUsers) {
            where.userId = { not: null };
        }

        const subscriptions = await prisma.pushSubscription.findMany({
            where,
            include: {
                user: filters.onlyVerified ? true : false
            }
        });

        if (subscriptions.length === 0) {
            return {
                success: true,
                message: 'No subscriptions found',
                sent: 0,
                failed: 0,
                total: 0
            };
        }

        // Process in batches to avoid memory issues
        const batchSize = 100;
        const batches = [];
        for (let i = 0; i < subscriptions.length; i += batchSize) {
            batches.push(subscriptions.slice(i, i + batchSize));
        }

        let totalSent = 0;
        let totalFailed = 0;

        for (const batch of batches) {
            const results = await Promise.all(
                batch.map(sub => sendPushNotification(sub, payload))
            );

            totalSent += results.filter(r => r.success).length;
            totalFailed += results.filter(r => !r.success).length;
        }

        return {
            success: true,
            sent: totalSent,
            failed: totalFailed,
            total: subscriptions.length
        };
    } catch (error) {
        console.error('Error broadcasting:', error);
        throw error;
    }
}

// Clean up expired subscriptions
async function cleanupExpiredSubscriptions() {
    try {
        // This is a utility function that can be called periodically
        // For now, expired subscriptions are removed when they fail to send
        console.log('Cleanup function called - expired subscriptions are removed automatically on send failure');
        return { success: true };
    } catch (error) {
        console.error('Error cleaning up subscriptions:', error);
        throw error;
    }
}

// Save subscription to database
async function saveSubscription(subscriptionData, userId = null, sessionId = null, userAgent = null) {
    try {
        const { endpoint, keys } = subscriptionData;

        // Check if subscription already exists
        const existing = await prisma.pushSubscription.findUnique({
            where: { endpoint }
        });

        if (existing) {
            // Update existing subscription
            return await prisma.pushSubscription.update({
                where: { endpoint },
                data: {
                    userId,
                    sessionId,
                    p256dh: keys.p256dh,
                    auth: keys.auth,
                    userAgent
                }
            });
        }

        // Create new subscription
        return await prisma.pushSubscription.create({
            data: {
                endpoint,
                p256dh: keys.p256dh,
                auth: keys.auth,
                userId,
                sessionId,
                userAgent
            }
        });
    } catch (error) {
        console.error('Error saving subscription:', error);
        throw error;
    }
}

// Remove subscription from database
async function removeSubscription(endpoint) {
    try {
        await prisma.pushSubscription.delete({
            where: { endpoint }
        });
        return { success: true };
    } catch (error) {
        if (error.code === 'P2025') {
            // Record not found
            return { success: true, message: 'Subscription not found' };
        }
        console.error('Error removing subscription:', error);
        throw error;
    }
}

// Helper function to notify all admins
async function notifyAdmins(payload) {
    try {
        // Get all admin users
        const admins = await prisma.user.findMany({
            where: { role: 'ADMIN' },
            include: { pushSubscriptions: true, notificationPreferences: true }
        });

        const results = {
            success: true,
            totalAdmins: admins.length,
            notified: 0,
            failed: 0,
            errors: []
        };

        for (const admin of admins) {
            try {
                // Check if admin has subscriptions
                if (!admin.pushSubscriptions || admin.pushSubscriptions.length === 0) {
                    continue;
                }

                // Send notification
                await sendToUser(admin.id, payload);

                // Save to notification history
                await prisma.notificationHistory.create({
                    data: {
                        userId: admin.id,
                        title: payload.title,
                        body: payload.body,
                        url: payload.url,
                        icon: payload.icon
                    }
                });

                results.notified++;
            } catch (error) {
                results.failed++;
                results.errors.push({ adminId: admin.id, error: error.message });
            }
        }

        return results;
    } catch (error) {
        console.error('Error notifying admins:', error);
        throw error;
    }
}

// Notify admins about new order
async function notifyNewOrder(orderId, orderData) {
    try {
        const payload = {
            title: `New Order #${orderData.orderNumber || orderId.slice(0, 8)}`,
            body: `Order from ${orderData.customerName || 'Customer'} - ₹${orderData.total?.toFixed(2) || '0.00'}`,
            url: `/orders/${orderId}`,
            icon: '/icons/manifest-icon-192.maskable.png'
        };

        // Get admins with newOrders preference enabled
        const admins = await prisma.user.findMany({
            where: {
                role: 'ADMIN',
                notificationPreferences: {
                    newOrders: true
                }
            },
            include: { pushSubscriptions: true }
        });

        for (const admin of admins) {
            if (admin.pushSubscriptions && admin.pushSubscriptions.length > 0) {
                await sendToUser(admin.id, payload);

                // Save to history
                await prisma.notificationHistory.create({
                    data: {
                        userId: admin.id,
                        title: payload.title,
                        body: payload.body,
                        url: payload.url,
                        icon: payload.icon
                    }
                });
            }
        }

        return { success: true, notified: admins.length };
    } catch (error) {
        console.error('Error notifying new order:', error);
        throw error;
    }
}

// Notify admins about order status change
async function notifyOrderStatusChange(orderId, orderNumber, oldStatus, newStatus) {
    try {
        const payload = {
            title: `Order #${orderNumber || orderId.slice(0, 8)} ${newStatus}`,
            body: `Order status changed from ${oldStatus} to ${newStatus}`,
            url: `/orders/${orderId}`,
            icon: '/icons/manifest-icon-192.maskable.png'
        };

        // Get admins with orderStatusChange preference enabled
        const admins = await prisma.user.findMany({
            where: {
                role: 'ADMIN',
                notificationPreferences: {
                    orderStatusChange: true
                }
            },
            include: { pushSubscriptions: true }
        });

        for (const admin of admins) {
            if (admin.pushSubscriptions && admin.pushSubscriptions.length > 0) {
                await sendToUser(admin.id, payload);

                // Save to history
                await prisma.notificationHistory.create({
                    data: {
                        userId: admin.id,
                        title: payload.title,
                        body: payload.body,
                        url: payload.url,
                        icon: payload.icon
                    }
                });
            }
        }

        return { success: true, notified: admins.length };
    } catch (error) {
        console.error('Error notifying order status change:', error);
        throw error;
    }
}

// Notify admins about low stock
async function notifyLowStock(productId, productName, currentStock, threshold = 10) {
    try {
        const payload = {
            title: 'Low Stock Alert',
            body: `${productName} - Only ${currentStock} units left`,
            url: `/inventory`,
            icon: '/icons/manifest-icon-192.maskable.png'
        };

        // Get admins with lowStock preference enabled
        const admins = await prisma.user.findMany({
            where: {
                role: 'ADMIN',
                notificationPreferences: {
                    lowStock: true
                }
            },
            include: { pushSubscriptions: true }
        });

        for (const admin of admins) {
            if (admin.pushSubscriptions && admin.pushSubscriptions.length > 0) {
                await sendToUser(admin.id, payload);

                // Save to history
                await prisma.notificationHistory.create({
                    data: {
                        userId: admin.id,
                        title: payload.title,
                        body: payload.body,
                        url: payload.url,
                        icon: payload.icon
                    }
                });
            }
        }

        return { success: true, notified: admins.length };
    } catch (error) {
        console.error('Error notifying low stock:', error);
        throw error;
    }
}

module.exports = {
    initializeWebPush,
    sendPushNotification,
    sendToUser,
    sendToSession,
    broadcastToAll,
    cleanupExpiredSubscriptions,
    saveSubscription,
    removeSubscription,
    notifyAdmins,
    notifyNewOrder,
    notifyOrderStatusChange,
    notifyLowStock
};
