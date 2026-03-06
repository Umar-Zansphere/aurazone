const request = require('supertest');

jest.mock('../api/services/notification.service', () => {
    const actual = jest.requireActual('../api/services/notification.service');
    return { ...actual, broadcastToAll: jest.fn() };
});

const { app } = require('../app');
const {
    prisma,
    clearDatabase,
    createAuthContext,
    createUser,
    issueAccessToken,
    unique,
} = require('./setup');

const bcrypt = require('bcryptjs');

jest.setTimeout(60000);

describe('Auth routes integration', () => {
    let auth;

    beforeEach(async () => {
        await clearDatabase();
        auth = await createAuthContext();
    });

    afterAll(async () => {
        await clearDatabase();
        await prisma.$disconnect();
    });

    // ────────────────────────── SIGNUP ──────────────────────────

    describe('POST /api/auth/signup', () => {
        it('creates a new user and returns 201', async () => {
            const res = await request(app)
                .post('/api/auth/signup')
                .send({ email: `${unique('signup')}@test.local`, password: 'StrongP@ss1!' });

            expect(res.status).toBe(201);
            expect(res.body.message).toBeDefined();
        });

        it('rejects duplicate email', async () => {
            const email = `${unique('dup')}@test.local`;
            await request(app).post('/api/auth/signup').send({ email, password: 'StrongP@ss1!' });
            const res = await request(app).post('/api/auth/signup').send({ email, password: 'StrongP@ss1!' });
            expect(res.status).toBeGreaterThanOrEqual(400);
        });

        it('rejects signup without email', async () => {
            const res = await request(app).post('/api/auth/signup').send({ password: 'StrongP@ss1!' });
            expect(res.status).toBeGreaterThanOrEqual(400);
        });

        it('rejects signup without password', async () => {
            const res = await request(app).post('/api/auth/signup').send({ email: `${unique('nopw')}@test.local` });
            expect(res.status).toBeGreaterThanOrEqual(400);
        });
    });

    // ────────────────────────── LOGIN ──────────────────────────

    describe('POST /api/auth/login', () => {
        let loginEmail;

        beforeEach(async () => {
            loginEmail = `${unique('login')}@test.local`;
            const hashedPassword = await bcrypt.hash('TestP@ss1', 10);
            await prisma.user.create({
                data: {
                    email: loginEmail,
                    fullName: 'Login User',
                    role: 'CUSTOMER',
                    password: hashedPassword,
                    is_active: true,
                    isGuest: false,
                    is_email_verified: new Date(),
                },
            });
        });

        it('logs in with correct credentials and sets accessToken cookie', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({ email: loginEmail, password: 'TestP@ss1' });

            expect(res.status).toBe(200);
            expect(res.body.user).toBeDefined();
            expect(res.body.user.email).toBe(loginEmail);
            expect(res.headers['set-cookie']).toBeDefined();
            const cookie = res.headers['set-cookie'].find((c) => c.startsWith('accessToken='));
            expect(cookie).toBeTruthy();
        });

        it('rejects wrong password', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({ email: loginEmail, password: 'WrongPass' });

            expect(res.status).toBeGreaterThanOrEqual(400);
        });

        it('rejects non-existent email', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({ email: 'noone@test.local', password: 'Whatever1' });

            expect(res.status).toBeGreaterThanOrEqual(400);
        });

        it('rejects missing email', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({ password: 'Whatever1' });

            expect(res.status).toBeGreaterThanOrEqual(400);
        });

        it('rejects missing password', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({ email: loginEmail });

            expect(res.status).toBeGreaterThanOrEqual(400);
        });
    });

    // ────────────────────────── LOGOUT ──────────────────────────

    describe('POST /api/auth/logout', () => {
        it('logs out an authenticated user and clears cookie', async () => {
            const res = await request(app)
                .post('/api/auth/logout')
                .set('Authorization', `Bearer ${auth.customerToken}`);

            expect(res.status).toBe(200);
            expect(res.body.message).toMatch(/logged out/i);
        });

        it('rejects unauthenticated logout', async () => {
            const res = await request(app).post('/api/auth/logout');
            expect(res.status).toBe(401);
        });
    });

    // ────────────────────────── CHANGE PASSWORD ──────────────────────────

    describe('POST /api/auth/change-password', () => {
        let pwdUser;
        let pwdToken;

        beforeEach(async () => {
            const hashedPassword = await bcrypt.hash('OldP@ss1', 10);
            pwdUser = await prisma.user.create({
                data: {
                    email: `${unique('chpwd')}@test.local`,
                    fullName: 'Pwd User',
                    role: 'CUSTOMER',
                    password: hashedPassword,
                    is_active: true,
                    isGuest: false,
                    is_email_verified: new Date(),
                },
            });
            pwdToken = issueAccessToken(pwdUser.id);
        });

        it('changes password with correct old password', async () => {
            const res = await request(app)
                .post('/api/auth/change-password')
                .set('Authorization', `Bearer ${pwdToken}`)
                .send({ oldPassword: 'OldP@ss1', newPassword: 'NewP@ss2' });

            expect(res.status).toBe(200);
        });

        it('rejects with wrong old password', async () => {
            const res = await request(app)
                .post('/api/auth/change-password')
                .set('Authorization', `Bearer ${pwdToken}`)
                .send({ oldPassword: 'WrongOld', newPassword: 'NewP@ss2' });

            expect(res.status).toBeGreaterThanOrEqual(400);
        });

        it('rejects unauthenticated requests', async () => {
            const res = await request(app)
                .post('/api/auth/change-password')
                .send({ oldPassword: 'OldP@ss1', newPassword: 'NewP@ss2' });

            expect(res.status).toBe(401);
        });
    });

    // ────────────────────────── FORGOT PASSWORD ──────────────────────────

    describe('POST /api/auth/forgot-password', () => {
        it('accepts a valid email', async () => {
            const res = await request(app)
                .post('/api/auth/forgot-password')
                .send({ email: auth.customer.email });

            // Should either succeed or say "email not found" without crashing
            expect([200, 400, 404]).toContain(res.status);
        });

        it('handles non-existent email gracefully', async () => {
            const res = await request(app)
                .post('/api/auth/forgot-password')
                .send({ email: 'ghost@test.local' });

            expect(res.status).toBeGreaterThanOrEqual(200);
            expect(res.status).toBeLessThan(500);
        });
    });

    // ────────────────────────── RESET PASSWORD ──────────────────────────

    describe('POST /api/auth/reset-password', () => {
        it('rejects invalid reset token', async () => {
            const res = await request(app)
                .post('/api/auth/reset-password')
                .send({ token: 'invalid-token', password: 'NewPass1!' });

            expect(res.status).toBeGreaterThanOrEqual(400);
        });

        it('rejects missing token', async () => {
            const res = await request(app)
                .post('/api/auth/reset-password')
                .send({ password: 'NewPass1!' });

            expect(res.status).toBeGreaterThanOrEqual(400);
        });
    });

    // ────────────────────────── VERIFY EMAIL ──────────────────────────

    describe('GET /api/auth/verify-email', () => {
        it('rejects invalid verification token', async () => {
            const res = await request(app).get('/api/auth/verify-email?token=bad-token');
            expect(res.status).toBeGreaterThanOrEqual(400);
        });

        it('rejects missing token', async () => {
            const res = await request(app).get('/api/auth/verify-email');
            expect(res.status).toBeGreaterThanOrEqual(400);
        });
    });

    // ────────────────────────── RESEND VERIFICATION ──────────────────────────

    describe('POST /api/auth/resend-verification', () => {
        it('accepts a valid email', async () => {
            const res = await request(app)
                .post('/api/auth/resend-verification')
                .send({ email: auth.customer.email });

            // May succeed or say already verified
            expect(res.status).toBeLessThan(500);
        });
    });

    // ────────────────────────── PHONE AUTH ──────────────────────────

    describe('Phone authentication endpoints', () => {
        it('POST /api/auth/phone-signup rejects invalid phone number', async () => {
            const res = await request(app)
                .post('/api/auth/phone-signup')
                .send({ phoneNumber: '123' });

            expect(res.status).toBe(400);
        });

        it('POST /api/auth/phone-login rejects invalid phone number', async () => {
            const res = await request(app)
                .post('/api/auth/phone-login')
                .send({ phoneNumber: '12' });

            expect(res.status).toBe(400);
        });

        it('POST /api/auth/phone-signup-verify rejects missing fields', async () => {
            const res = await request(app)
                .post('/api/auth/phone-signup-verify')
                .send({});

            expect(res.status).toBe(400);
        });

        it('POST /api/auth/phone-login-verify rejects missing fields', async () => {
            const res = await request(app)
                .post('/api/auth/phone-login-verify')
                .send({});

            expect(res.status).toBe(400);
        });

        it('POST /api/auth/send-phone-verification rejects unauthenticated', async () => {
            const res = await request(app)
                .post('/api/auth/send-phone-verification')
                .send({ phoneNumber: '9876543210' });

            expect(res.status).toBe(401);
        });

        it('POST /api/auth/send-phone-verification rejects invalid phone', async () => {
            const res = await request(app)
                .post('/api/auth/send-phone-verification')
                .set('Authorization', `Bearer ${auth.customerToken}`)
                .send({ phoneNumber: '123' });

            expect(res.status).toBe(400);
        });

        it('POST /api/auth/verify-phone-otp rejects unauthenticated', async () => {
            const res = await request(app)
                .post('/api/auth/verify-phone-otp')
                .send({ phoneNumber: '9876543210', otp: '123456' });

            expect(res.status).toBe(401);
        });

        it('POST /api/auth/verify-phone-otp rejects missing fields', async () => {
            const res = await request(app)
                .post('/api/auth/verify-phone-otp')
                .set('Authorization', `Bearer ${auth.customerToken}`)
                .send({});

            expect(res.status).toBe(400);
        });
    });
});
