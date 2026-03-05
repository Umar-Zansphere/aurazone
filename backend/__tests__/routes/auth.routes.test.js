/**
 * Integration tests for Auth routes (/api/auth)
 * Tests all 14 auth endpoints via Supertest
 */
const request = require('supertest');
const jwt = require('jsonwebtoken');

// Must mock BEFORE requiring the app
jest.mock('../../config/prisma', () => {
    const { createMockPrisma } = require('../setup');
    return createMockPrisma();
});
jest.mock('../../config/email', () => ({ sendEmail: jest.fn().mockResolvedValue(true) }));
jest.mock('../../api/services/notification.service', () => ({
    initializeWebPush: jest.fn(),
    sendPushNotification: jest.fn().mockResolvedValue(true),
    sendToUser: jest.fn().mockResolvedValue({ sent: 0, failed: 0 }),
    sendToSession: jest.fn().mockResolvedValue({ sent: 0, failed: 0 }),
    broadcastToAll: jest.fn().mockResolvedValue({ sent: 0, failed: 0 }),
    cleanupExpiredSubscriptions: jest.fn(),
    saveSubscription: jest.fn(),
    removeSubscription: jest.fn(),
    notifyAdmins: jest.fn().mockResolvedValue(true),
    notifyNewOrder: jest.fn().mockResolvedValue(true),
    notifyOrderStatusChange: jest.fn().mockResolvedValue(true),
    notifyLowStock: jest.fn().mockResolvedValue(true),
}));
jest.mock('../../api/services/s3.services', () => ({
    uploadInMemory: { any: () => (req, res, next) => next(), single: () => (req, res, next) => next() },
    uploadBufferToS3: jest.fn().mockResolvedValue('https://s3.test.com/image.jpg'),
    uploadProductImage: { any: () => (req, res, next) => next(), single: () => (req, res, next) => next() },
}));
jest.mock('../../api/services/auth.services');
jest.mock('../../api/services/session.services', () => ({
    getOrCreateSession: jest.fn().mockResolvedValue({ id: 'db-1', sessionId: 'session-1', expiresAt: new Date(Date.now() + 86400000) }),
    validateSession: jest.fn().mockResolvedValue(true),
    migrateSessionToUser: jest.fn().mockResolvedValue({ migrated: true }),
    cleanupExpiredSessions: jest.fn(),
}));

const app = require('../testApp');
const prisma = require('../../config/prisma');
const authService = require('../../api/services/auth.services');
const { MOCK_USER, generateTestToken } = require('../setup');

describe('Auth Routes', () => {
    describe('POST /api/auth/signup', () => {
        it('should return 201 on successful signup', async () => {
            authService.signup.mockResolvedValue({ message: 'Account created. Please verify your email.' });
            const res = await request(app)
                .post('/api/auth/signup')
                .send({ email: 'new@test.com', password: 'Password123!' });
            expect(res.status).toBe(201);
            expect(res.body.message).toContain('verify');
        });

        it('should forward errors via global error handler', async () => {
            const error = new Error('Email already exists');
            error.statusCode = 409;
            authService.signup.mockRejectedValue(error);
            const res = await request(app)
                .post('/api/auth/signup')
                .send({ email: 'existing@test.com', password: 'Password123!' });
            expect(res.status).toBe(409);
        });
    });

    describe('POST /api/auth/login', () => {
        it('should return user data and set accessToken cookie on success', async () => {
            authService.login.mockResolvedValue({
                accessToken: 'test-token',
                user: { id: MOCK_USER.id, fullName: MOCK_USER.fullName, role: MOCK_USER.role, email: MOCK_USER.email, phone: MOCK_USER.phone },
            });
            const res = await request(app)
                .post('/api/auth/login')
                .send({ email: 'test@test.com', password: 'Password123!' });
            expect(res.status).toBe(200);
            expect(res.body.user).toBeDefined();
            expect(res.body.user.email).toBe(MOCK_USER.email);
        });

        it('should forward auth errors', async () => {
            const error = new Error('Invalid credentials');
            error.statusCode = 401;
            authService.login.mockRejectedValue(error);
            const res = await request(app)
                .post('/api/auth/login')
                .send({ email: 'test@test.com', password: 'wrong' });
            expect(res.status).toBe(401);
        });
    });

    describe('GET /api/auth/verify-email', () => {
        it('should verify email with valid token', async () => {
            authService.verifyEmail.mockResolvedValue({ message: 'Email verified successfully' });
            const res = await request(app)
                .get('/api/auth/verify-email')
                .query({ token: 'valid-token' });
            expect(res.status).toBe(200);
        });
    });

    describe('POST /api/auth/resend-verification', () => {
        it('should resend verification email', async () => {
            authService.resendVerification.mockResolvedValue(true);
            const res = await request(app)
                .post('/api/auth/resend-verification')
                .send({ email: 'test@test.com' });
            expect(res.status).toBe(200);
        });
    });

    describe('POST /api/auth/forgot-password', () => {
        it('should send reset email', async () => {
            authService.forgotPassword.mockResolvedValue({ message: 'Reset email sent' });
            const res = await request(app)
                .post('/api/auth/forgot-password')
                .send({ email: 'test@test.com' });
            expect(res.status).toBe(200);
        });
    });

    describe('POST /api/auth/reset-password', () => {
        it('should reset password with valid token', async () => {
            authService.resetPassword.mockResolvedValue({ message: 'Password reset successful' });
            const res = await request(app)
                .post('/api/auth/reset-password')
                .send({ token: 'reset-token', password: 'NewPassword123!' });
            expect(res.status).toBe(200);
        });
    });

    describe('POST /api/auth/change-password', () => {
        it('should change password for authenticated user', async () => {
            const token = generateTestToken();
            prisma.user.findUnique.mockResolvedValue({ id: MOCK_USER.id, is_active: true, role: 'CUSTOMER' });
            authService.changePassword.mockResolvedValue({ message: 'Password changed' });
            const res = await request(app)
                .post('/api/auth/change-password')
                .set('Cookie', `accessToken=${token}`)
                .send({ oldPassword: 'OldPass123!', newPassword: 'NewPass123!' });
            expect(res.status).toBe(200);
        });

        it('should return 401 when not authenticated', async () => {
            const res = await request(app)
                .post('/api/auth/change-password')
                .send({ oldPassword: 'OldPass123!', newPassword: 'NewPass123!' });
            expect(res.status).toBe(401);
        });
    });

    describe('POST /api/auth/logout', () => {
        it('should logout authenticated user', async () => {
            const token = generateTestToken();
            prisma.user.findUnique.mockResolvedValue({ id: MOCK_USER.id, is_active: true, role: 'CUSTOMER' });
            const res = await request(app)
                .post('/api/auth/logout')
                .set('Cookie', `accessToken=${token}`);
            expect(res.status).toBe(200);
            expect(res.body.message).toContain('Logged out');
        });
    });

    describe('POST /api/auth/phone-signup', () => {
        it('should initiate phone signup', async () => {
            authService.phoneSignup.mockResolvedValue({ message: 'OTP sent' });
            const res = await request(app)
                .post('/api/auth/phone-signup')
                .send({ phoneNumber: '+1234567890', email: 'phone@test.com', password: 'Pass123!' });
            expect(res.status).toBe(200);
        });

        it('should return 400 for invalid phone number', async () => {
            const res = await request(app)
                .post('/api/auth/phone-signup')
                .send({ phoneNumber: '123', email: 'phone@test.com', password: 'Pass123!' });
            expect(res.status).toBe(400);
        });
    });

    describe('POST /api/auth/phone-signup-verify', () => {
        it('should verify phone signup with OTP', async () => {
            authService.phoneSignupVerify.mockResolvedValue({
                accessToken: 'new-token',
                message: 'Account created',
                user: { id: 'new-user', fullName: 'New', email: 'phone@test.com' },
            });
            const res = await request(app)
                .post('/api/auth/phone-signup-verify')
                .send({ phoneNumber: '+1234567890', otp: '123456' });
            expect(res.status).toBe(201);
        });

        it('should return 400 when phone or otp missing', async () => {
            const res = await request(app)
                .post('/api/auth/phone-signup-verify')
                .send({ phoneNumber: '+1234567890' });
            expect(res.status).toBe(400);
        });
    });

    describe('POST /api/auth/phone-login', () => {
        it('should initiate phone login', async () => {
            authService.phoneLogin.mockResolvedValue({ message: 'OTP sent' });
            const res = await request(app)
                .post('/api/auth/phone-login')
                .send({ phoneNumber: '+1234567890' });
            expect(res.status).toBe(200);
        });
    });

    describe('POST /api/auth/phone-login-verify', () => {
        it('should verify phone login', async () => {
            authService.phoneLoginVerify.mockResolvedValue({
                accessToken: 'login-token',
                message: 'Logged in',
                user: { id: MOCK_USER.id, phone: MOCK_USER.phone, fullName: MOCK_USER.fullName, userRole: 'CUSTOMER', email: MOCK_USER.email },
            });
            const res = await request(app)
                .post('/api/auth/phone-login-verify')
                .send({ phoneNumber: '+1234567890', otp: '123456' });
            expect(res.status).toBe(200);
            expect(res.body.user).toBeDefined();
        });
    });

    describe('POST /api/auth/send-phone-verification', () => {
        it('should send phone verification for authenticated user', async () => {
            const token = generateTestToken();
            prisma.user.findUnique.mockResolvedValue({ id: MOCK_USER.id, is_active: true, role: 'CUSTOMER' });
            authService.sendPhoneVerification.mockResolvedValue({ message: 'OTP sent' });
            const res = await request(app)
                .post('/api/auth/send-phone-verification')
                .set('Cookie', `accessToken=${token}`)
                .send({ phoneNumber: '+1234567890' });
            expect(res.status).toBe(200);
        });
    });

    describe('POST /api/auth/verify-phone-otp', () => {
        it('should verify phone OTP for authenticated user', async () => {
            const token = generateTestToken();
            prisma.user.findUnique.mockResolvedValue({ id: MOCK_USER.id, is_active: true, role: 'CUSTOMER' });
            authService.verifyPhoneOtp.mockResolvedValue({ message: 'Phone verified' });
            const res = await request(app)
                .post('/api/auth/verify-phone-otp')
                .set('Cookie', `accessToken=${token}`)
                .send({ phoneNumber: '+1234567890', otp: '123456' });
            expect(res.status).toBe(200);
        });
    });
});
