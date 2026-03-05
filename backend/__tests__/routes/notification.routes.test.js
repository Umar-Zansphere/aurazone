/**
 * Integration tests for Notification routes (/api/notifications)
 * Tests VAPID key, subscribe, unsubscribe, admin notification endpoints
 */
const request = require('supertest');

jest.mock('../../config/prisma', () => {
    const { createMockPrisma } = require('../setup');
    return createMockPrisma();
});
jest.mock('../../config/email', () => ({ sendEmail: jest.fn() }));
jest.mock('../../api/services/notification.service', () => ({
    initializeWebPush: jest.fn(), sendPushNotification: jest.fn().mockResolvedValue(true),
    sendToUser: jest.fn().mockResolvedValue({ sent: 1, failed: 0 }),
    sendToSession: jest.fn().mockResolvedValue({ sent: 0, failed: 0 }),
    broadcastToAll: jest.fn().mockResolvedValue({ sent: 1, failed: 0 }),
    cleanupExpiredSubscriptions: jest.fn(), saveSubscription: jest.fn().mockResolvedValue({ id: 'sub-1' }),
    removeSubscription: jest.fn().mockResolvedValue(true), notifyAdmins: jest.fn(),
    notifyNewOrder: jest.fn(), notifyOrderStatusChange: jest.fn(), notifyLowStock: jest.fn(),
}));
jest.mock('../../api/services/s3.services', () => ({
    uploadInMemory: { any: () => (r, s, n) => n(), single: () => (r, s, n) => n() },
    uploadBufferToS3: jest.fn(), uploadProductImage: { any: () => (r, s, n) => n() },
}));
jest.mock('../../api/services/session.services', () => ({
    getOrCreateSession: jest.fn().mockResolvedValue({ id: 'db-1', sessionId: 's-1', expiresAt: new Date(Date.now() + 86400000) }),
    validateSession: jest.fn(), migrateSessionToUser: jest.fn(), cleanupExpiredSessions: jest.fn(),
}));

const app = require('../testApp');
const prisma = require('../../config/prisma');
const { generateTestToken, generateAdminToken, MOCK_USER, MOCK_ADMIN } = require('../setup');

const authHeaders = (token) => ({ Cookie: `accessToken=${token}` });

describe('Notification Routes', () => {
    describe('GET /api/notifications/vapid-key', () => {
        it('should return VAPID public key', async () => {
            const res = await request(app).get('/api/notifications/vapid-key');
            expect(res.status).toBe(200);
            expect(res.body.publicKey).toBeDefined();
        });
    });

    describe('POST /api/notifications/subscribe', () => {
        it('should subscribe authenticated user', async () => {
            const token = generateTestToken();
            prisma.user.findUnique.mockResolvedValue({ id: MOCK_USER.id, is_active: true, role: 'CUSTOMER' });
            prisma.pushSubscription.upsert.mockResolvedValue({ id: 'sub-1' });
            const res = await request(app).post('/api/notifications/subscribe').set(authHeaders(token)).send({
                subscription: { endpoint: 'https://push.test/sub', keys: { p256dh: 'k1', auth: 'a1' } },
            });
            expect(res.status).toBe(200);
        });

        it('should return 401 without auth', async () => {
            const res = await request(app).post('/api/notifications/subscribe').send({
                subscription: { endpoint: 'https://push.test/sub', keys: { p256dh: 'k1', auth: 'a1' } },
            });
            expect(res.status).toBe(401);
        });
    });

    describe('DELETE /api/notifications/unsubscribe', () => {
        it('should unsubscribe user', async () => {
            const token = generateTestToken();
            prisma.user.findUnique.mockResolvedValue({ id: MOCK_USER.id, is_active: true, role: 'CUSTOMER' });
            prisma.pushSubscription.deleteMany.mockResolvedValue({ count: 1 });
            const res = await request(app).delete('/api/notifications/unsubscribe').set(authHeaders(token)).send({
                endpoint: 'https://push.test/sub',
            });
            expect(res.status).toBe(200);
        });
    });

    // ======================== ADMIN ROUTES ========================
    describe('GET /api/notifications/history (Admin)', () => {
        it('should return notification history for admin', async () => {
            const adminToken = generateAdminToken();
            prisma.user.findUnique.mockResolvedValue({ id: MOCK_ADMIN.id, is_active: true, role: 'ADMIN' });
            prisma.notificationHistory.findMany.mockResolvedValue([]);
            prisma.notificationHistory.count.mockResolvedValue(0);
            const res = await request(app).get('/api/notifications/history').set(authHeaders(adminToken));
            expect(res.status).toBe(200);
        });

        it('should return 403 for non-admin', async () => {
            const token = generateTestToken();
            prisma.user.findUnique.mockResolvedValue({ id: MOCK_USER.id, is_active: true, role: 'CUSTOMER' });
            const res = await request(app).get('/api/notifications/history').set(authHeaders(token));
            expect(res.status).toBe(403);
        });
    });

    describe('GET /api/notifications/unread-count (Admin)', () => {
        it('should return unread count', async () => {
            const adminToken = generateAdminToken();
            prisma.user.findUnique.mockResolvedValue({ id: MOCK_ADMIN.id, is_active: true, role: 'ADMIN' });
            prisma.notificationHistory.count.mockResolvedValue(5);
            const res = await request(app).get('/api/notifications/unread-count').set(authHeaders(adminToken));
            expect(res.status).toBe(200);
        });
    });

    describe('PATCH /api/notifications/:id/read (Admin)', () => {
        it('should mark notification as read', async () => {
            const adminToken = generateAdminToken();
            prisma.user.findUnique.mockResolvedValue({ id: MOCK_ADMIN.id, is_active: true, role: 'ADMIN' });
            prisma.notificationHistory.update.mockResolvedValue({ id: 'notif-1', isRead: true });
            const res = await request(app).patch('/api/notifications/notif-1/read').set(authHeaders(adminToken));
            expect(res.status).toBe(200);
        });
    });

    describe('GET /api/notifications/preferences (Admin)', () => {
        it('should return preferences', async () => {
            const adminToken = generateAdminToken();
            prisma.user.findUnique.mockResolvedValue({ id: MOCK_ADMIN.id, is_active: true, role: 'ADMIN' });
            prisma.notificationPreferences.findFirst.mockResolvedValue({ id: 'pref-1', newOrders: true });
            const res = await request(app).get('/api/notifications/preferences').set(authHeaders(adminToken));
            expect(res.status).toBe(200);
        });
    });

    describe('POST /api/notifications/preferences (Admin)', () => {
        it('should update preferences', async () => {
            const adminToken = generateAdminToken();
            prisma.user.findUnique.mockResolvedValue({ id: MOCK_ADMIN.id, is_active: true, role: 'ADMIN' });
            prisma.notificationPreferences.upsert.mockResolvedValue({ id: 'pref-1' });
            const res = await request(app).post('/api/notifications/preferences').set(authHeaders(adminToken)).send({ newOrders: true, lowStock: false });
            expect(res.status).toBe(200);
        });
    });

    describe('POST /api/notifications/send (Admin)', () => {
        it('should send notification to specific user', async () => {
            const adminToken = generateAdminToken();
            prisma.user.findUnique.mockResolvedValue({ id: MOCK_ADMIN.id, is_active: true, role: 'ADMIN' });
            prisma.pushSubscription.findMany.mockResolvedValue([
                { id: 'sub-1', endpoint: 'https://push.test/1', p256dh: 'k1', auth: 'a1' },
            ]);
            prisma.notificationHistory.create.mockResolvedValue({ id: 'hist-1' });
            const res = await request(app).post('/api/notifications/send').set(authHeaders(adminToken)).send({
                userId: 'user-1', title: 'Hello', body: 'Message',
            });
            expect(res.status).toBe(200);
        });
    });

    describe('POST /api/notifications/broadcast (Admin)', () => {
        it('should broadcast notification', async () => {
            const adminToken = generateAdminToken();
            prisma.user.findUnique.mockResolvedValue({ id: MOCK_ADMIN.id, is_active: true, role: 'ADMIN' });
            prisma.pushSubscription.findMany.mockResolvedValue([]);
            prisma.notificationHistory.create.mockResolvedValue({ id: 'hist-1' });
            const res = await request(app).post('/api/notifications/broadcast').set(authHeaders(adminToken)).send({
                title: 'Sale!', body: '50% off everything',
            });
            expect(res.status).toBe(200);
        });
    });
});
