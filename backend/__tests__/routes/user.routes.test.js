/**
 * Integration tests for User routes (/api/users)
 * Tests all 9 user/address endpoints via Supertest
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
jest.mock('../../api/services/user.services');
jest.mock('../../api/services/session.services', () => ({
    getOrCreateSession: jest.fn().mockResolvedValue({ id: 'db-1', sessionId: 's-1', expiresAt: new Date(Date.now() + 86400000) }),
    validateSession: jest.fn(), migrateSessionToUser: jest.fn(), cleanupExpiredSessions: jest.fn(),
}));

const app = require('../testApp');
const prisma = require('../../config/prisma');
const userService = require('../../api/services/user.services');
const { generateTestToken, MOCK_USER, MOCK_ADDRESS } = require('../setup');

// Helper to set up auth for all tests
const authHeaders = (token) => ({ Cookie: `accessToken=${token}` });

describe('User Routes', () => {
    let token;

    beforeEach(() => {
        token = generateTestToken();
        prisma.user.findUnique.mockResolvedValue({ id: MOCK_USER.id, is_active: true, role: 'CUSTOMER' });
    });

    describe('GET /api/users/profile', () => {
        it('should return user profile', async () => {
            userService.getUserProfile.mockResolvedValue(MOCK_USER);
            const res = await request(app).get('/api/users/profile').set(authHeaders(token));
            expect(res.status).toBe(200);
            expect(res.body.email).toBe(MOCK_USER.email);
        });

        it('should return 401 without auth', async () => {
            const res = await request(app).get('/api/users/profile');
            expect(res.status).toBe(401);
        });
    });

    describe('PUT /api/users/profile', () => {
        it('should update profile', async () => {
            userService.updateProfile.mockResolvedValue({ message: 'Updated', user: { ...MOCK_USER, fullName: 'New Name' } });
            const res = await request(app).put('/api/users/profile').set(authHeaders(token)).send({ fullName: 'New Name' });
            expect(res.status).toBe(200);
        });

        it('should return 400 when no fields provided', async () => {
            const res = await request(app).put('/api/users/profile').set(authHeaders(token)).send({});
            expect(res.status).toBe(400);
        });
    });

    describe('PUT /api/users/phone', () => {
        it('should update phone number', async () => {
            userService.updatePhoneNumber.mockResolvedValue({ message: 'Phone updated' });
            const res = await request(app).put('/api/users/phone').set(authHeaders(token)).send({ phoneNumber: '+9876543210' });
            expect(res.status).toBe(200);
        });

        it('should return 400 for invalid phone', async () => {
            const res = await request(app).put('/api/users/phone').set(authHeaders(token)).send({ phoneNumber: '123' });
            expect(res.status).toBe(400);
        });
    });

    describe('GET /api/users/addresses', () => {
        it('should return all user addresses', async () => {
            userService.getUserAddresses.mockResolvedValue([MOCK_ADDRESS]);
            const res = await request(app).get('/api/users/addresses').set(authHeaders(token));
            expect(res.status).toBe(200);
            expect(Array.isArray(res.body)).toBe(true);
        });
    });

    describe('GET /api/users/addresses/:addressId', () => {
        it('should return single address', async () => {
            userService.getAddressById.mockResolvedValue(MOCK_ADDRESS);
            const res = await request(app).get('/api/users/addresses/addr-1').set(authHeaders(token));
            expect(res.status).toBe(200);
        });
    });

    describe('POST /api/users/addresses', () => {
        it('should create new address', async () => {
            userService.createAddress.mockResolvedValue({ message: 'Created', address: MOCK_ADDRESS });
            const res = await request(app).post('/api/users/addresses').set(authHeaders(token)).send({
                name: 'Home', phone: '+1234567890', addressLine1: '123 St',
                city: 'City', state: 'ST', postalCode: '12345', country: 'US',
            });
            expect(res.status).toBe(201);
        });
    });

    describe('PUT /api/users/addresses/:addressId', () => {
        it('should update address', async () => {
            userService.updateAddress.mockResolvedValue({ message: 'Updated', address: MOCK_ADDRESS });
            const res = await request(app).put('/api/users/addresses/addr-1').set(authHeaders(token)).send({ name: 'Office' });
            expect(res.status).toBe(200);
        });
    });

    describe('DELETE /api/users/addresses/:addressId', () => {
        it('should delete address', async () => {
            userService.deleteAddress.mockResolvedValue({ message: 'Deleted' });
            const res = await request(app).delete('/api/users/addresses/addr-1').set(authHeaders(token));
            expect(res.status).toBe(200);
        });
    });

    describe('PATCH /api/users/addresses/:addressId/default', () => {
        it('should set default address', async () => {
            userService.setDefaultAddress.mockResolvedValue({ message: 'Default set', address: MOCK_ADDRESS });
            const res = await request(app).patch('/api/users/addresses/addr-1/default').set(authHeaders(token));
            expect(res.status).toBe(200);
        });
    });
});
