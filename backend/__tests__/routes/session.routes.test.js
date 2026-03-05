/**
 * Integration tests for Session routes (/api/session)
 * Tests create, validate, and migrate endpoints
 */
const request = require('supertest');

jest.mock('../../config/prisma', () => {
    const { createMockPrisma } = require('../setup');
    return createMockPrisma();
});
jest.mock('../../config/email', () => ({ sendEmail: jest.fn() }));
jest.mock('../../api/services/notification.service', () => ({
    initializeWebPush: jest.fn(), sendPushNotification: jest.fn(), sendToUser: jest.fn(),
    sendToSession: jest.fn(), broadcastToAll: jest.fn(), cleanupExpiredSubscriptions: jest.fn(),
    saveSubscription: jest.fn(), removeSubscription: jest.fn(), notifyAdmins: jest.fn(),
    notifyNewOrder: jest.fn(), notifyOrderStatusChange: jest.fn(), notifyLowStock: jest.fn(),
}));
jest.mock('../../api/services/s3.services', () => ({
    uploadInMemory: { any: () => (r, s, n) => n(), single: () => (r, s, n) => n() },
    uploadBufferToS3: jest.fn(), uploadProductImage: { any: () => (r, s, n) => n() },
}));
jest.mock('../../api/services/session.services', () => ({
    getOrCreateSession: jest.fn(),
    validateSession: jest.fn(),
    migrateSessionToUser: jest.fn(),
    cleanupExpiredSessions: jest.fn(),
}));

const app = require('../testApp');
const prisma = require('../../config/prisma');
const sessionService = require('../../api/services/session.services');
const { generateTestToken, MOCK_USER } = require('../setup');

describe('Session Routes', () => {
    describe('POST /api/session/create', () => {
        it('should create a new guest session', async () => {
            sessionService.getOrCreateSession.mockResolvedValue({
                sessionId: 'new-session-id',
                expiresAt: new Date(Date.now() + 86400000),
            });
            const res = await request(app).post('/api/session/create');
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.sessionId).toBe('new-session-id');
        });

        it('should handle service errors', async () => {
            sessionService.getOrCreateSession.mockRejectedValue(new Error('DB error'));
            const res = await request(app).post('/api/session/create');
            expect(res.status).toBe(500);
        });
    });

    describe('GET /api/session/validate', () => {
        it('should validate a valid session from header', async () => {
            sessionService.validateSession.mockResolvedValue(true);
            const res = await request(app).get('/api/session/validate').set('x-session-id', 'valid-session');
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });

        it('should return 400 when no session ID provided', async () => {
            const res = await request(app).get('/api/session/validate');
            expect(res.status).toBe(400);
        });

        it('should return 401 for invalid session', async () => {
            sessionService.validateSession.mockResolvedValue(false);
            const res = await request(app).get('/api/session/validate').set('x-session-id', 'expired-session');
            expect(res.status).toBe(401);
        });
    });

    describe('POST /api/session/migrate', () => {
        it('should migrate session to authenticated user', async () => {
            const token = generateTestToken();
            prisma.user.findUnique.mockResolvedValue({ id: MOCK_USER.id, is_active: true, role: 'CUSTOMER', email: MOCK_USER.email, phone: MOCK_USER.phone, fullName: MOCK_USER.fullName });
            sessionService.migrateSessionToUser.mockResolvedValue({ cartItemsMigrated: 3, wishlistItemsMigrated: 1 });
            const res = await request(app)
                .post('/api/session/migrate')
                .set('Cookie', `accessToken=${token}`)
                .set('x-session-id', 'guest-session');
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });

        it('should return 401 when not authenticated', async () => {
            const res = await request(app)
                .post('/api/session/migrate')
                .set('x-session-id', 'guest-session');
            expect(res.status).toBe(401);
        });

        it('should return 400 when no session ID', async () => {
            const token = generateTestToken();
            prisma.user.findUnique.mockResolvedValue({ id: MOCK_USER.id, is_active: true, role: 'CUSTOMER', email: MOCK_USER.email, phone: MOCK_USER.phone, fullName: MOCK_USER.fullName });
            const res = await request(app)
                .post('/api/session/migrate')
                .set('Cookie', `accessToken=${token}`);
            expect(res.status).toBe(400);
        });
    });
});
