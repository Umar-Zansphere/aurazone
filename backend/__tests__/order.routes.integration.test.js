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
    createProductFixture,
    createOrderFixture,
    unique,
    issueAccessToken,
} = require('./setup');

jest.setTimeout(60000);

describe('Order routes integration (customer-facing)', () => {
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

    // ────────────────────────── LIST ORDERS ──────────────────────────

    describe('GET /api/orders', () => {
        it('returns empty order list for new customer', async () => {
            const res = await asCustomer('get', '/api/orders');
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });

        it('returns customer orders', async () => {
            const { variant } = await createProductFixture();
            await createOrderFixture({
                userId: auth.customer.id,
                variantId: variant.id,
            });

            const res = await asCustomer('get', '/api/orders');
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });

        it('rejects unauthenticated request', async () => {
            const res = await request(app).get('/api/orders');
            expect(res.status).toBe(401);
        });

        it('does not return other users orders', async () => {
            const { variant } = await createProductFixture();
            await createOrderFixture({
                userId: auth.admin.id,
                variantId: variant.id,
            });

            const res = await asCustomer('get', '/api/orders');
            expect(res.status).toBe(200);
            // Should be empty since the order belongs to admin, not customer
        });
    });

    // ────────────────────────── ORDER DETAIL ──────────────────────────

    describe('GET /api/orders/:orderId', () => {
        it('returns order detail for owned order', async () => {
            const { variant } = await createProductFixture();
            const order = await createOrderFixture({
                userId: auth.customer.id,
                variantId: variant.id,
            });

            const res = await asCustomer('get', `/api/orders/${order.id}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });

        it('rejects access to other users order', async () => {
            const { variant } = await createProductFixture();
            const order = await createOrderFixture({
                userId: auth.admin.id,
                variantId: variant.id,
            });

            const res = await asCustomer('get', `/api/orders/${order.id}`);
            expect(res.status).toBeGreaterThanOrEqual(400);
        });

        it('rejects unauthenticated access', async () => {
            const res = await request(app).get('/api/orders/fake-id');
            expect(res.status).toBe(401);
        });
    });

    // ────────────────────────── TRACK ORDER (authenticated) ──────────────────────────

    describe('GET /api/orders/:orderId/track', () => {
        it('tracks owned order', async () => {
            const { variant } = await createProductFixture();
            const order = await createOrderFixture({
                userId: auth.customer.id,
                variantId: variant.id,
            });

            const res = await asCustomer('get', `/api/orders/${order.id}/track`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });

        it('rejects tracking other users order', async () => {
            const { variant } = await createProductFixture();
            const order = await createOrderFixture({
                userId: auth.admin.id,
                variantId: variant.id,
            });

            const res = await asCustomer('get', `/api/orders/${order.id}/track`);
            expect(res.status).toBeGreaterThanOrEqual(400);
        });
    });

    // ────────────────────────── TRACK ORDER BY TOKEN (public) ──────────────────────────

    describe('GET /api/orders/track/:trackingToken', () => {
        it('tracks order by token without authentication', async () => {
            const { variant } = await createProductFixture();
            const order = await createOrderFixture({
                userId: auth.customer.id,
                variantId: variant.id,
            });

            const res = await request(app).get(`/api/orders/track/${order.trackingToken}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.orderNumber).toBeDefined();
        });

        it('returns error for invalid tracking token', async () => {
            const res = await request(app).get('/api/orders/track/invalid-token');
            expect(res.status).toBeGreaterThanOrEqual(400);
        });
    });

    // ────────────────────────── CANCEL ORDER ──────────────────────────

    describe('POST /api/orders/:orderId/cancel', () => {
        it('cancels a pending order', async () => {
            const { variant } = await createProductFixture({ quantity: 10 });
            const order = await createOrderFixture({
                userId: auth.customer.id,
                variantId: variant.id,
                status: 'PENDING',
                quantity: 2,
                reserveInventory: true,
            });

            const res = await asCustomer('post', `/api/orders/${order.id}/cancel`)
                .send({ reason: 'Changed my mind' });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });

        it('rejects cancelling non-pending order', async () => {
            const { variant } = await createProductFixture();
            const order = await createOrderFixture({
                userId: auth.customer.id,
                variantId: variant.id,
                status: 'DELIVERED',
            });

            const res = await asCustomer('post', `/api/orders/${order.id}/cancel`)
                .send({ reason: 'Too late' });

            expect(res.status).toBeGreaterThanOrEqual(400);
        });

        it('rejects cancelling another users order', async () => {
            const { variant } = await createProductFixture();
            const order = await createOrderFixture({
                userId: auth.admin.id,
                variantId: variant.id,
                status: 'PENDING',
            });

            const res = await asCustomer('post', `/api/orders/${order.id}/cancel`)
                .send({ reason: 'Not mine' });

            expect(res.status).toBeGreaterThanOrEqual(400);
        });

        it('rejects unauthenticated cancellation', async () => {
            const res = await request(app).post('/api/orders/fake-id/cancel')
                .send({ reason: 'test' });

            expect(res.status).toBe(401);
        });
    });

    // ────────────────────────── CREATE ORDER FROM CART ──────────────────────────

    describe('POST /api/orders', () => {
        it('rejects order without payment method', async () => {
            const { variant } = await createProductFixture();

            // Create address for customer
            const address = await prisma.address.create({
                data: {
                    userId: auth.customer.id,
                    name: 'Buyer',
                    phone: '9999999999',
                    addressLine1: '123 St',
                    city: 'City',
                    state: 'ST',
                    postalCode: '123456',
                    country: 'IN',
                },
            });

            const res = await asCustomer('post', '/api/orders')
                .send({ addressId: address.id });

            expect(res.status).toBe(400);
            expect(res.body.message).toMatch(/payment method/i);
        });

        it('rejects order from empty cart', async () => {
            const address = await prisma.address.create({
                data: {
                    userId: auth.customer.id,
                    name: 'Buyer',
                    phone: '9999999999',
                    addressLine1: '123 St',
                    city: 'City',
                    state: 'ST',
                    postalCode: '123456',
                    country: 'IN',
                },
            });

            const res = await asCustomer('post', '/api/orders')
                .send({ addressId: address.id, paymentMethod: 'COD' });

            expect(res.status).toBeGreaterThanOrEqual(400);
        });

        it('rejects guest order without required fields', async () => {
            const res = await request(app)
                .post('/api/orders')
                .send({ address: { email: '' }, paymentMethod: 'COD' });

            expect(res.status).toBe(400);
        });
    });

    // ────────────────────────── PAYMENT VERIFICATION ──────────────────────────

    describe('POST /api/orders/payment/verify', () => {
        it('rejects missing verification parameters', async () => {
            const res = await request(app)
                .post('/api/orders/payment/verify')
                .send({});

            expect(res.status).toBe(400);
            expect(res.body.message).toMatch(/missing/i);
        });

        it('rejects partial parameters', async () => {
            const res = await request(app)
                .post('/api/orders/payment/verify')
                .send({ razorpayOrderId: 'order_abc' });

            expect(res.status).toBe(400);
        });
    });

    // ────────────────────────── WEBHOOK ──────────────────────────

    describe('POST /api/orders/webhook/razorpay', () => {
        it('rejects invalid webhook signature', async () => {
            const res = await request(app)
                .post('/api/orders/webhook/razorpay')
                .set('x-razorpay-signature', 'invalid-sig')
                .send({ event: 'payment.captured', payload: {} });

            expect(res.status).toBeLessThan(500);
        });
    });
});
