/**
 * Integration tests for Cart and Wishlist routes (/api/cart, /api/wishlist)
 * Tests all 6 cart + 5 wishlist endpoints via Supertest
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
jest.mock('../../api/services/cart.services');
jest.mock('../../api/services/session.services', () => ({
    getOrCreateSession: jest.fn().mockResolvedValue({ id: 'db-1', sessionId: 'guest-session-1', expiresAt: new Date(Date.now() + 86400000) }),
    validateSession: jest.fn().mockResolvedValue(true),
    migrateSessionToUser: jest.fn(), cleanupExpiredSessions: jest.fn(),
}));

const app = require('../testApp');
const prisma = require('../../config/prisma');
const cartService = require('../../api/services/cart.services');
const { generateTestToken, MOCK_USER } = require('../setup');

describe('Cart Routes', () => {
    describe('GET /api/cart', () => {
        it('should return cart for guest user', async () => {
            cartService.getActiveCart.mockResolvedValue({ items: [], total: 0 });
            const res = await request(app).get('/api/cart');
            expect(res.status).toBe(200);
        });

        it('should return cart for authenticated user', async () => {
            const token = generateTestToken();
            prisma.user.findUnique.mockResolvedValue({ id: MOCK_USER.id, is_active: true, role: 'CUSTOMER', email: MOCK_USER.email, phone: MOCK_USER.phone, fullName: MOCK_USER.fullName });
            cartService.getActiveCart.mockResolvedValue({ items: [{ id: 'ci-1' }], total: 1 });
            const res = await request(app).get('/api/cart').set('Cookie', `accessToken=${token}`);
            expect(res.status).toBe(200);
        });
    });

    describe('GET /api/cart/summary', () => {
        it('should return cart summary', async () => {
            cartService.getCartSummary.mockResolvedValue({ itemCount: 2, subtotal: 199.98 });
            const res = await request(app).get('/api/cart/summary');
            expect(res.status).toBe(200);
        });
    });

    describe('POST /api/cart', () => {
        it('should add item to cart', async () => {
            cartService.addToCart.mockResolvedValue({ message: 'Added to cart', item: { id: 'ci-1' } });
            const res = await request(app).post('/api/cart').send({ variantId: 'v-1', quantity: 2 });
            expect(res.status).toBe(201);
        });

        it('should return 400 when variantId is missing', async () => {
            const res = await request(app).post('/api/cart').send({ quantity: 2 });
            expect(res.status).toBe(400);
        });

        it('should return 400 when quantity is negative', async () => {
            const res = await request(app).post('/api/cart').send({ variantId: 'v-1', quantity: -1 });
            expect(res.status).toBe(400);
        });
    });

    describe('PATCH /api/cart/:cartItemId', () => {
        it('should update cart item quantity', async () => {
            cartService.updateCartItem.mockResolvedValue({ message: 'Updated', item: { id: 'ci-1' } });
            const res = await request(app).patch('/api/cart/ci-1').send({ quantity: 3 });
            expect(res.status).toBe(200);
        });

        it('should return 400 when quantity missing', async () => {
            const res = await request(app).patch('/api/cart/ci-1').send({});
            expect(res.status).toBe(400);
        });
    });

    describe('DELETE /api/cart/:cartItemId', () => {
        it('should remove item from cart', async () => {
            cartService.removeFromCart.mockResolvedValue({ message: 'Removed' });
            const res = await request(app).delete('/api/cart/ci-1');
            expect(res.status).toBe(200);
        });
    });

    describe('DELETE /api/cart', () => {
        it('should clear entire cart', async () => {
            cartService.clearCart.mockResolvedValue({ message: 'Cart cleared' });
            const res = await request(app).delete('/api/cart');
            expect(res.status).toBe(200);
        });
    });
});

describe('Wishlist Routes', () => {
    describe('GET /api/wishlist', () => {
        it('should return wishlist', async () => {
            cartService.getWishlist.mockResolvedValue({ items: [] });
            const res = await request(app).get('/api/wishlist');
            expect(res.status).toBe(200);
        });
    });

    describe('POST /api/wishlist', () => {
        it('should add item to wishlist', async () => {
            cartService.addToWishlist.mockResolvedValue({ message: 'Added to wishlist' });
            const res = await request(app).post('/api/wishlist').send({ productId: 'p-1', variantId: 'v-1' });
            expect(res.status).toBe(201);
        });

        it('should return 400 when productId missing', async () => {
            const res = await request(app).post('/api/wishlist').send({});
            expect(res.status).toBe(400);
        });
    });

    describe('DELETE /api/wishlist/:wishlistItemId', () => {
        it('should remove item from wishlist', async () => {
            cartService.removeFromWishlist.mockResolvedValue({ message: 'Removed' });
            const res = await request(app).delete('/api/wishlist/wi-1');
            expect(res.status).toBe(200);
        });
    });

    describe('POST /api/wishlist/:wishlistItemId/move-to-cart', () => {
        it('should move wishlist item to cart', async () => {
            cartService.moveToCart.mockResolvedValue({ message: 'Moved to cart' });
            const res = await request(app).post('/api/wishlist/wi-1/move-to-cart');
            expect(res.status).toBe(200);
        });
    });

    describe('DELETE /api/wishlist', () => {
        it('should clear entire wishlist', async () => {
            cartService.clearWishlist.mockResolvedValue({ message: 'Wishlist cleared' });
            const res = await request(app).delete('/api/wishlist');
            expect(res.status).toBe(200);
        });
    });
});
