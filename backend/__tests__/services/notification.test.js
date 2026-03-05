/**
 * Unit tests for api/services/notification.service.js
 * Tests web-push initialization, subscriptions, sending, and admin notifications
 */

jest.mock('../../config/prisma', () => {
    const { createMockPrisma } = require('../setup');
    return createMockPrisma();
});

jest.mock('web-push', () => ({
    setVapidDetails: jest.fn(),
    sendNotification: jest.fn().mockResolvedValue({ statusCode: 201 }),
}));

const prisma = require('../../config/prisma');
const webPush = require('web-push');
const notificationService = require('../../api/services/notification.service');

describe('Notification Service', () => {
    describe('initializeWebPush', () => {
        it('should call setVapidDetails with env variables', () => {
            process.env.VAPID_EMAIL = 'test@test.com';
            process.env.VAPID_PUBLIC_KEY = 'pub_key';
            process.env.VAPID_PRIVATE_KEY = 'priv_key';
            notificationService.initializeWebPush();
            expect(webPush.setVapidDetails).toHaveBeenCalled();
        });
    });

    describe('sendPushNotification', () => {
        it('should send notification to a subscription and return success', async () => {
            webPush.sendNotification.mockResolvedValueOnce({ statusCode: 201 });
            // sendPushNotification expects { endpoint, p256dh, auth } from DB schema
            const subscription = { endpoint: 'https://push.test/sub1', p256dh: 'k1', auth: 'k2' };
            const payload = { title: 'Test', body: 'Hello' };
            const result = await notificationService.sendPushNotification(subscription, payload);
            expect(result).toBeDefined();
            expect(result.success).toBe(true);
        });

        it('should return success:false on send failure (does not throw)', async () => {
            webPush.sendNotification.mockRejectedValueOnce(new Error('Push failed'));
            const subscription = { endpoint: 'https://push.test/sub2', p256dh: 'k1', auth: 'k2' };
            // sendPushNotification catches errors internally and returns { success: false }
            const result = await notificationService.sendPushNotification(subscription, { title: 'Test' });
            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        });

        it('should remove expired subscription (410) from DB', async () => {
            const error = new Error('Gone');
            error.statusCode = 410;
            webPush.sendNotification.mockRejectedValueOnce(error);
            prisma.pushSubscription.delete.mockResolvedValue({});
            const subscription = { endpoint: 'https://push.test/expired', p256dh: 'k1', auth: 'k2' };
            await notificationService.sendPushNotification(subscription, { title: 'Test' });
            expect(prisma.pushSubscription.delete).toHaveBeenCalledWith({
                where: { endpoint: 'https://push.test/expired' },
            });
        });
    });

    describe('sendToUser', () => {
        it('should send notifications to all user subscriptions', async () => {
            prisma.pushSubscription.findMany.mockResolvedValue([
                { id: 'sub-1', endpoint: 'https://push.test/1', p256dh: 'k1', auth: 'a1' },
                { id: 'sub-2', endpoint: 'https://push.test/2', p256dh: 'k2', auth: 'a2' },
            ]);
            webPush.sendNotification.mockResolvedValue({ statusCode: 201 });
            const result = await notificationService.sendToUser('user-1', { title: 'Test' });
            expect(result).toBeDefined();
            expect(result.success).toBe(true);
            expect(result.sent).toBe(2);
        });

        it('should return gracefully when no subscriptions found', async () => {
            prisma.pushSubscription.findMany.mockResolvedValue([]);
            const result = await notificationService.sendToUser('user-no-subs', { title: 'Test' });
            expect(result).toBeDefined();
            expect(result.success).toBe(false);
        });
    });

    describe('sendToSession', () => {
        it('should send notifications to guest session subscriptions', async () => {
            prisma.pushSubscription.findMany.mockResolvedValue([
                { id: 'sub-3', endpoint: 'https://push.test/3', p256dh: 'k3', auth: 'a3' },
            ]);
            webPush.sendNotification.mockResolvedValue({ statusCode: 201 });
            const result = await notificationService.sendToSession('session-1', { title: 'Guest Test' });
            expect(result).toBeDefined();
            expect(result.success).toBe(true);
        });
    });

    describe('broadcastToAll', () => {
        it('should broadcast to all subscriptions', async () => {
            prisma.pushSubscription.findMany.mockResolvedValue([
                { id: 'sub-1', endpoint: 'https://push.test/1', p256dh: 'k1', auth: 'a1' },
            ]);
            webPush.sendNotification.mockResolvedValue({ statusCode: 201 });
            const result = await notificationService.broadcastToAll({ title: 'Broadcast', body: 'Hi all' });
            expect(result).toBeDefined();
            expect(result.sent).toBe(1);
        });

        it('should return zero counts when no subscriptions', async () => {
            prisma.pushSubscription.findMany.mockResolvedValue([]);
            const result = await notificationService.broadcastToAll({ title: 'Broadcast' });
            expect(result.sent).toBe(0);
            expect(result.total).toBe(0);
        });
    });

    describe('saveSubscription', () => {
        it('should create a new subscription when none exists', async () => {
            prisma.pushSubscription.findUnique.mockResolvedValue(null);
            prisma.pushSubscription.create.mockResolvedValue({ id: 'sub-new', endpoint: 'https://push.test/new' });
            const result = await notificationService.saveSubscription(
                { endpoint: 'https://push.test/new', keys: { p256dh: 'k1', auth: 'a1' } },
                'user-1'
            );
            expect(result).toBeDefined();
            expect(prisma.pushSubscription.create).toHaveBeenCalled();
        });

        it('should update existing subscription', async () => {
            prisma.pushSubscription.findUnique.mockResolvedValue({ id: 'sub-existing', endpoint: 'https://push.test/existing' });
            prisma.pushSubscription.update.mockResolvedValue({ id: 'sub-existing' });
            const result = await notificationService.saveSubscription(
                { endpoint: 'https://push.test/existing', keys: { p256dh: 'k1', auth: 'a1' } },
                null, 'session-1'
            );
            expect(result).toBeDefined();
            expect(prisma.pushSubscription.update).toHaveBeenCalled();
        });
    });

    describe('removeSubscription', () => {
        it('should remove a subscription by endpoint', async () => {
            prisma.pushSubscription.delete.mockResolvedValue({ id: 'sub-1' });
            const result = await notificationService.removeSubscription('https://push.test/old');
            expect(result).toBeDefined();
            expect(result.success).toBe(true);
        });

        it('should handle not-found gracefully', async () => {
            const error = new Error('Not found');
            error.code = 'P2025';
            prisma.pushSubscription.delete.mockRejectedValue(error);
            const result = await notificationService.removeSubscription('https://push.test/gone');
            expect(result.success).toBe(true);
        });
    });

    describe('notifyAdmins', () => {
        it('should send notification to admin subscriptions and save history', async () => {
            prisma.user.findMany.mockResolvedValue([{
                id: 'admin-1',
                pushSubscriptions: [{ id: 'sub-admin', endpoint: 'https://push.test/admin', p256dh: 'k1', auth: 'a1' }],
                notificationPreferences: { newOrders: true },
            }]);
            prisma.pushSubscription.findMany.mockResolvedValue([
                { id: 'sub-admin', endpoint: 'https://push.test/admin', p256dh: 'k1', auth: 'a1' },
            ]);
            prisma.notificationHistory.create.mockResolvedValue({ id: 'hist-1' });
            webPush.sendNotification.mockResolvedValue({ statusCode: 201 });
            const result = await notificationService.notifyAdmins({ title: 'Admin Alert', body: 'Test' });
            expect(result).toBeDefined();
            expect(result.notified).toBe(1);
        });

        it('should skip admins without subscriptions', async () => {
            prisma.user.findMany.mockResolvedValue([{
                id: 'admin-1',
                pushSubscriptions: [],
                notificationPreferences: {},
            }]);
            const result = await notificationService.notifyAdmins({ title: 'Alert', body: 'Test' });
            expect(result).toBeDefined();
        });
    });

    describe('notifyNewOrder', () => {
        it('should notify admins about a new order', async () => {
            prisma.user.findMany.mockResolvedValue([{
                id: 'admin-1',
                pushSubscriptions: [{ id: 'sub-1', endpoint: 'https://push.test/1', p256dh: 'k1', auth: 'a1' }],
            }]);
            prisma.pushSubscription.findMany.mockResolvedValue([
                { id: 'sub-1', endpoint: 'https://push.test/1', p256dh: 'k1', auth: 'a1' },
            ]);
            prisma.notificationHistory.create.mockResolvedValue({ id: 'hist-1' });
            webPush.sendNotification.mockResolvedValue({ statusCode: 201 });
            const result = await notificationService.notifyNewOrder('order-1', {
                orderNumber: 'AUR-001',
                total: 99.99,
                customerName: 'Test User',
            });
            expect(result).toBeDefined();
            expect(result.success).toBe(true);
        });
    });

    describe('notifyLowStock', () => {
        it('should notify admins about low stock', async () => {
            prisma.user.findMany.mockResolvedValue([{
                id: 'admin-1',
                pushSubscriptions: [{ id: 'sub-1', endpoint: 'https://push.test/1', p256dh: 'k1', auth: 'a1' }],
            }]);
            prisma.pushSubscription.findMany.mockResolvedValue([
                { id: 'sub-1', endpoint: 'https://push.test/1', p256dh: 'k1', auth: 'a1' },
            ]);
            prisma.notificationHistory.create.mockResolvedValue({ id: 'hist-1' });
            webPush.sendNotification.mockResolvedValue({ statusCode: 201 });
            const result = await notificationService.notifyLowStock('prod-1', 'Test Sneaker', 3, 10);
            expect(result).toBeDefined();
            expect(result.success).toBe(true);
        });
    });
});
