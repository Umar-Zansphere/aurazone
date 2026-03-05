/**
 * Integration tests for Order routes (/api/orders)
 * Tests all 8 order and payment endpoints via Supertest
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
jest.mock('../../api/services/order.services');
jest.mock('../../api/services/razorpay.services', () => ({
    createRazorpayOrder: jest.fn(), verifyPaymentSignature: jest.fn(),
    getPaymentDetails: jest.fn(), capturePayment: jest.fn(),
    refundPayment: jest.fn(), processPaymentWebhook: jest.fn(),
    validateWebhookSignature: jest.fn(),
    handlePaymentAuthorized: jest.fn(), handlePaymentFailed: jest.fn(),
    handlePaymentCaptured: jest.fn(), handleOrderPaid: jest.fn(),
    handleRefundCreated: jest.fn(), handleRefundProcessed: jest.fn(),
}));
jest.mock('../../api/services/session.services', () => ({
    getOrCreateSession: jest.fn().mockResolvedValue({ id: 'db-1', sessionId: 'guest-1', expiresAt: new Date(Date.now() + 86400000) }),
    validateSession: jest.fn(), migrateSessionToUser: jest.fn(), cleanupExpiredSessions: jest.fn(),
}));

const app = require('../testApp');
const prisma = require('../../config/prisma');
const orderService = require('../../api/services/order.services');
const razorpayService = require('../../api/services/razorpay.services');
const { generateTestToken, MOCK_USER } = require('../setup');

const authHeaders = (token) => ({ Cookie: `accessToken=${token}` });

describe('Order Routes', () => {
    let token;
    beforeEach(() => {
        token = generateTestToken();
        prisma.user.findUnique.mockResolvedValue({ id: MOCK_USER.id, is_active: true, role: 'CUSTOMER', email: MOCK_USER.email, phone: MOCK_USER.phone, fullName: MOCK_USER.fullName });
    });

    describe('POST /api/orders (Authenticated)', () => {
        it('should create order from cart for authenticated user', async () => {
            orderService.createOrderFromCart.mockResolvedValue({ orderId: 'ord-1', orderNumber: 'AUR-001' });
            const res = await request(app).post('/api/orders').set(authHeaders(token)).send({
                addressId: 'addr-1', paymentMethod: 'COD',
            });
            expect(res.status).toBe(201);
            expect(res.body.success).toBe(true);
        });

        it('should return 400 when paymentMethod missing for auth user', async () => {
            const res = await request(app).post('/api/orders').set(authHeaders(token)).send({ addressId: 'addr-1' });
            expect(res.status).toBe(400);
        });
    });

    describe('POST /api/orders (Guest)', () => {
        it('should create order for guest user', async () => {
            orderService.createOrderFromCartAsGuest.mockResolvedValue({ orderId: 'ord-2', orderNumber: 'AUR-002' });
            const res = await request(app).post('/api/orders').send({
                address: { email: 'guest@test.com', phone: '+1234567890', addressLine1: '123 St', city: 'C', state: 'S', postalCode: '12345', country: 'US' },
                paymentMethod: 'COD',
            });
            expect(res.status).toBe(201);
        });

        it('should return 400 for guest without email', async () => {
            const res = await request(app).post('/api/orders').send({
                address: { phone: '+1234567890' }, paymentMethod: 'COD',
            });
            expect(res.status).toBe(400);
        });
    });

    describe('GET /api/orders', () => {
        it('should return customer orders', async () => {
            orderService.getCustomerOrders.mockResolvedValue({ orders: [], total: 0 });
            const res = await request(app).get('/api/orders').set(authHeaders(token));
            expect(res.status).toBe(200);
        });

        it('should return 401 without auth', async () => {
            const res = await request(app).get('/api/orders');
            expect(res.status).toBe(401);
        });
    });

    describe('GET /api/orders/:orderId', () => {
        it('should return order detail', async () => {
            orderService.getCustomerOrderDetail.mockResolvedValue({ id: 'ord-1', status: 'PENDING' });
            const res = await request(app).get('/api/orders/ord-1').set(authHeaders(token));
            expect(res.status).toBe(200);
        });
    });

    describe('GET /api/orders/track/:trackingToken', () => {
        it('should track order by token without auth', async () => {
            orderService.getOrderByTrackingToken.mockResolvedValue({
                id: 'ord-1', orderNumber: 'AUR-001', status: 'SHIPPED',
                paymentStatus: 'SUCCESS', totalAmount: 99.99, createdAt: new Date(),
                items: [], shipments: [], orderAddress: {},
            });
            const res = await request(app).get('/api/orders/track/tok-123');
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });
    });

    describe('GET /api/orders/:orderId/track', () => {
        it('should track order for authenticated user', async () => {
            orderService.trackOrder.mockResolvedValue({ status: 'SHIPPED', timeline: [] });
            const res = await request(app).get('/api/orders/ord-1/track').set(authHeaders(token));
            expect(res.status).toBe(200);
        });
    });

    describe('POST /api/orders/:orderId/cancel', () => {
        it('should cancel order', async () => {
            orderService.cancelCustomerOrder.mockResolvedValue({ message: 'Cancelled' });
            const res = await request(app).post('/api/orders/ord-1/cancel').set(authHeaders(token)).send({ reason: 'Changed mind' });
            expect(res.status).toBe(200);
        });
    });

    describe('POST /api/orders/payment/verify', () => {
        it('should verify Razorpay payment', async () => {
            razorpayService.verifyPaymentSignature.mockResolvedValue({ isValid: true });
            razorpayService.getPaymentDetails.mockResolvedValue({ status: 'captured', amount: 10000 });
            const res = await request(app).post('/api/orders/payment/verify').send({
                razorpayOrderId: 'order_1', razorpayPaymentId: 'pay_1', razorpaySignature: 'sig_1',
            });
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });

        it('should return 400 when missing params', async () => {
            const res = await request(app).post('/api/orders/payment/verify').send({ razorpayOrderId: 'order_1' });
            expect(res.status).toBe(400);
        });

        it('should return 400 for invalid signature', async () => {
            razorpayService.verifyPaymentSignature.mockResolvedValue({ isValid: false });
            const res = await request(app).post('/api/orders/payment/verify').send({
                razorpayOrderId: 'order_1', razorpayPaymentId: 'pay_1', razorpaySignature: 'bad',
            });
            expect(res.status).toBe(400);
        });
    });

    describe('POST /api/orders/webhook/razorpay', () => {
        it('should process valid webhook', async () => {
            razorpayService.validateWebhookSignature.mockReturnValue(true);
            razorpayService.processPaymentWebhook.mockResolvedValue({ processed: true });
            const res = await request(app).post('/api/orders/webhook/razorpay')
                .set('x-razorpay-signature', 'valid-sig')
                .send({ event: 'payment.captured', payload: {} });
            expect(res.status).toBe(200);
        });

        it('should return 400 for invalid webhook signature', async () => {
            razorpayService.validateWebhookSignature.mockReturnValue(false);
            const res = await request(app).post('/api/orders/webhook/razorpay')
                .set('x-razorpay-signature', 'bad-sig')
                .send({ event: 'payment.captured', payload: {} });
            expect(res.status).toBe(400);
        });
    });
});
