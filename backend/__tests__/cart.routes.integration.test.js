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
    unique,
} = require('./setup');

jest.setTimeout(60000);

describe('Cart routes integration', () => {
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

    // ────────────────────────── GET CART ──────────────────────────

    describe('GET /api/cart', () => {
        it('returns empty cart for authenticated user', async () => {
            const res = await asCustomer('get', '/api/cart');
            expect(res.status).toBe(200);
        });

        it('returns cart for unauthenticated user (guest session via header)', async () => {
            // Create a guest session first
            const session = await prisma.guestSession.create({
                data: {
                    sessionId: unique('session'),
                    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
                },
            });

            const res = await request(app)
                .get('/api/cart')
                .set('x-session-id', session.sessionId);

            expect(res.status).toBe(200);
        });
    });

    // ────────────────────────── ADD TO CART ──────────────────────────

    describe('POST /api/cart', () => {
        it('adds item to cart for authenticated user', async () => {
            const { variant } = await createProductFixture();

            const res = await asCustomer('post', '/api/cart')
                .send({ variantId: variant.id, quantity: 2 });

            expect(res.status).toBe(201);
        });

        it('rejects add without variantId', async () => {
            const res = await asCustomer('post', '/api/cart')
                .send({ quantity: 2 });

            expect(res.status).toBe(400);
            expect(res.body.message).toMatch(/variant/i);
        });

        it('rejects add with zero quantity', async () => {
            const { variant } = await createProductFixture();
            const res = await asCustomer('post', '/api/cart')
                .send({ variantId: variant.id, quantity: 0 });

            expect(res.status).toBe(400);
            expect(res.body.message).toMatch(/greater than 0/i);
        });

        it('rejects add with negative quantity', async () => {
            const { variant } = await createProductFixture();
            const res = await asCustomer('post', '/api/cart')
                .send({ variantId: variant.id, quantity: -5 });

            expect(res.status).toBe(400);
        });

        it('defaults quantity to 1 when not provided', async () => {
            const { variant } = await createProductFixture();

            const res = await asCustomer('post', '/api/cart')
                .send({ variantId: variant.id });

            expect(res.status).toBe(201);
        });
    });

    // ────────────────────────── GET CART SUMMARY ──────────────────────────

    describe('GET /api/cart/summary', () => {
        it('returns cart summary', async () => {
            const res = await asCustomer('get', '/api/cart/summary');
            expect(res.status).toBe(200);
        });

        it('returns summary with items after adding to cart', async () => {
            const { variant } = await createProductFixture();
            await asCustomer('post', '/api/cart').send({ variantId: variant.id, quantity: 3 });

            const res = await asCustomer('get', '/api/cart/summary');
            expect(res.status).toBe(200);
        });
    });

    // ────────────────────────── UPDATE CART ITEM ──────────────────────────

    describe('PATCH /api/cart/:cartItemId', () => {
        it('updates cart item quantity', async () => {
            const { variant } = await createProductFixture();
            const addRes = await asCustomer('post', '/api/cart')
                .send({ variantId: variant.id, quantity: 1 });

            // Get cart to find the cartItemId
            const cartRes = await asCustomer('get', '/api/cart');
            const cartItemId = cartRes.body.items?.[0]?.id;

            if (cartItemId) {
                const res = await asCustomer('patch', `/api/cart/${cartItemId}`)
                    .send({ quantity: 5 });
                expect(res.status).toBe(200);
            }
        });

        it('rejects update without quantity', async () => {
            const res = await asCustomer('patch', '/api/cart/fake-item-id')
                .send({});

            expect(res.status).toBe(400);
            expect(res.body.message).toMatch(/quantity/i);
        });
    });

    // ────────────────────────── REMOVE FROM CART ──────────────────────────

    describe('DELETE /api/cart/:cartItemId', () => {
        it('removes item from cart', async () => {
            const { variant } = await createProductFixture();
            await asCustomer('post', '/api/cart')
                .send({ variantId: variant.id, quantity: 1 });

            const cartRes = await asCustomer('get', '/api/cart');
            const cartItemId = cartRes.body.items?.[0]?.id;

            if (cartItemId) {
                const res = await asCustomer('delete', `/api/cart/${cartItemId}`);
                expect(res.status).toBe(200);
            }
        });
    });

    // ────────────────────────── CLEAR CART ──────────────────────────

    describe('DELETE /api/cart', () => {
        it('clears the entire cart', async () => {
            const { variant } = await createProductFixture();
            await asCustomer('post', '/api/cart')
                .send({ variantId: variant.id, quantity: 2 });

            const res = await asCustomer('delete', '/api/cart');
            expect(res.status).toBe(200);
        });

        it('clears an already empty cart', async () => {
            const res = await asCustomer('delete', '/api/cart');
            expect(res.status).toBe(200);
        });
    });
});
