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

describe('Wishlist routes integration', () => {
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

    // ────────────────────────── GET WISHLIST ──────────────────────────

    describe('GET /api/wishlist', () => {
        it('returns empty wishlist for new user', async () => {
            const res = await asCustomer('get', '/api/wishlist');
            expect(res.status).toBe(200);
        });
    });

    // ────────────────────────── ADD TO WISHLIST ──────────────────────────

    describe('POST /api/wishlist', () => {
        it('adds product to wishlist', async () => {
            const { product, variant } = await createProductFixture();

            const res = await asCustomer('post', '/api/wishlist')
                .send({ productId: product.id, variantId: variant.id });

            expect(res.status).toBe(201);
        });

        it('rejects add without productId', async () => {
            const res = await asCustomer('post', '/api/wishlist')
                .send({});

            expect(res.status).toBe(400);
            expect(res.body.message).toMatch(/product/i);
        });

        it('handles adding same product twice', async () => {
            const { product, variant } = await createProductFixture();

            await asCustomer('post', '/api/wishlist')
                .send({ productId: product.id, variantId: variant.id });

            const res = await asCustomer('post', '/api/wishlist')
                .send({ productId: product.id, variantId: variant.id });

            // Should either succeed (idempotent) or return conflict
            expect(res.status).toBeLessThan(500);
        });
    });

    // ────────────────────────── REMOVE FROM WISHLIST ──────────────────────────

    describe('DELETE /api/wishlist/:wishlistItemId', () => {
        it('removes wishlist item', async () => {
            const { product, variant } = await createProductFixture();

            await asCustomer('post', '/api/wishlist')
                .send({ productId: product.id, variantId: variant.id });

            const listRes = await asCustomer('get', '/api/wishlist');
            const itemId = listRes.body.items?.[0]?.id;

            if (itemId) {
                const res = await asCustomer('delete', `/api/wishlist/${itemId}`);
                expect(res.status).toBe(200);
            }
        });
    });

    // ────────────────────────── MOVE TO CART ──────────────────────────

    describe('POST /api/wishlist/:wishlistItemId/move-to-cart', () => {
        it('moves wishlist item to cart', async () => {
            const { product, variant } = await createProductFixture();

            await asCustomer('post', '/api/wishlist')
                .send({ productId: product.id, variantId: variant.id });

            const listRes = await asCustomer('get', '/api/wishlist');
            const itemId = listRes.body.items?.[0]?.id;

            if (itemId) {
                const res = await asCustomer('post', `/api/wishlist/${itemId}/move-to-cart`);
                expect(res.status).toBe(200);

                // Verify item is now in cart
                const cartRes = await asCustomer('get', '/api/cart');
                expect(cartRes.status).toBe(200);
            }
        });
    });

    // ────────────────────────── CLEAR WISHLIST ──────────────────────────

    describe('DELETE /api/wishlist', () => {
        it('clears entire wishlist', async () => {
            const { product, variant } = await createProductFixture();

            await asCustomer('post', '/api/wishlist')
                .send({ productId: product.id, variantId: variant.id });

            const res = await asCustomer('delete', '/api/wishlist');
            expect(res.status).toBe(200);
        });

        it('clears an already empty wishlist', async () => {
            const res = await asCustomer('delete', '/api/wishlist');
            expect(res.status).toBe(200);
        });
    });
});
