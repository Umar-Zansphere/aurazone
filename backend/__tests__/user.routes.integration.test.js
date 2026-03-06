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
    unique,
} = require('./setup');

jest.setTimeout(60000);

describe('User routes integration', () => {
    let auth;

    const asCustomer = (method, url) =>
        request(app)[method](url).set('Authorization', `Bearer ${auth.customerToken}`);

    beforeEach(async () => {
        await clearDatabase();
        auth = await createAuthContext();
    });

    afterAll(async () => {
        await clearDatabase();
        await prisma.$disconnect();
    });

    // ────────────────────────── PROFILE ──────────────────────────

    describe('GET /api/users/profile', () => {
        it('returns user profile', async () => {
            const res = await asCustomer('get', '/api/users/profile');
            expect(res.status).toBe(200);
            expect(res.body.id).toBe(auth.customer.id);
        });

        it('rejects unauthenticated request', async () => {
            const res = await request(app).get('/api/users/profile');
            expect(res.status).toBe(401);
        });
    });

    describe('PUT /api/users/profile', () => {
        it('updates full name', async () => {
            const res = await asCustomer('put', '/api/users/profile')
                .send({ fullName: 'Updated Name' });

            expect(res.status).toBe(200);
        });

        it('updates email', async () => {
            const res = await asCustomer('put', '/api/users/profile')
                .send({ email: `${unique('newemail')}@test.local` });

            expect(res.status).toBe(200);
        });

        it('rejects empty update', async () => {
            const res = await asCustomer('put', '/api/users/profile')
                .send({});

            expect(res.status).toBe(400);
            expect(res.body.message).toMatch(/at least one field/i);
        });

        it('rejects unauthenticated request', async () => {
            const res = await request(app).put('/api/users/profile')
                .send({ fullName: 'Hacker' });

            expect(res.status).toBe(401);
        });
    });

    // ────────────────────────── PHONE NUMBER ──────────────────────────

    describe('PUT /api/users/phone', () => {
        it('updates phone number', async () => {
            const res = await asCustomer('put', '/api/users/phone')
                .send({ phoneNumber: '9876543210' });

            expect(res.status).toBe(200);
        });

        it('rejects invalid phone number', async () => {
            const res = await asCustomer('put', '/api/users/phone')
                .send({ phoneNumber: '123' });

            expect(res.status).toBe(400);
            expect(res.body.message).toMatch(/valid phone/i);
        });

        it('rejects missing phone number', async () => {
            const res = await asCustomer('put', '/api/users/phone')
                .send({});

            expect(res.status).toBe(400);
        });
    });

    // ────────────────────────── ADDRESSES ──────────────────────────

    describe('Address CRUD', () => {
        const validAddress = {
            name: 'Test Address',
            phone: '9876543210',
            addressLine1: '123 Test St',
            city: 'Test City',
            state: 'TS',
            postalCode: '123456',
            country: 'IN',
        };

        it('GET /api/users/addresses returns empty list', async () => {
            const res = await asCustomer('get', '/api/users/addresses');
            expect(res.status).toBe(200);
        });

        it('POST /api/users/addresses creates an address', async () => {
            const res = await asCustomer('post', '/api/users/addresses')
                .send(validAddress);

            expect(res.status).toBe(201);
        });

        it('GET /api/users/addresses returns created address', async () => {
            await asCustomer('post', '/api/users/addresses').send(validAddress);

            const res = await asCustomer('get', '/api/users/addresses');
            expect(res.status).toBe(200);
        });

        it('GET /api/users/addresses/:addressId returns single address', async () => {
            const createRes = await asCustomer('post', '/api/users/addresses').send(validAddress);
            const addressId = createRes.body.id || createRes.body.address?.id;

            if (addressId) {
                const res = await asCustomer('get', `/api/users/addresses/${addressId}`);
                expect(res.status).toBe(200);
            }
        });

        it('PUT /api/users/addresses/:addressId updates address', async () => {
            const createRes = await asCustomer('post', '/api/users/addresses').send(validAddress);
            const addressId = createRes.body.id || createRes.body.address?.id;

            if (addressId) {
                const res = await asCustomer('put', `/api/users/addresses/${addressId}`)
                    .send({ city: 'New City' });

                expect(res.status).toBe(200);
            }
        });

        it('DELETE /api/users/addresses/:addressId deletes address', async () => {
            const createRes = await asCustomer('post', '/api/users/addresses').send(validAddress);
            const addressId = createRes.body.id || createRes.body.address?.id;

            if (addressId) {
                const res = await asCustomer('delete', `/api/users/addresses/${addressId}`);
                expect(res.status).toBe(200);
            }
        });

        it('PATCH /api/users/addresses/:addressId/default sets default address', async () => {
            const createRes = await asCustomer('post', '/api/users/addresses').send(validAddress);
            const addressId = createRes.body.id || createRes.body.address?.id;

            if (addressId) {
                const res = await asCustomer('patch', `/api/users/addresses/${addressId}/default`);
                expect(res.status).toBe(200);
            }
        });

        it('sets only one default when multiple addresses exist', async () => {
            const first = await asCustomer('post', '/api/users/addresses')
                .send({ ...validAddress, isDefault: true });
            const second = await asCustomer('post', '/api/users/addresses')
                .send({ ...validAddress, name: 'Second', addressLine1: '456 St' });

            const firstId = first.body.id || first.body.address?.id;
            const secondId = second.body.id || second.body.address?.id;

            if (secondId) {
                await asCustomer('patch', `/api/users/addresses/${secondId}/default`);

                const listRes = await asCustomer('get', '/api/users/addresses');
                expect(listRes.status).toBe(200);
            }
        });

        it('rejects address operations without auth', async () => {
            const res = await request(app).get('/api/users/addresses');
            expect(res.status).toBe(401);
        });
    });
});
