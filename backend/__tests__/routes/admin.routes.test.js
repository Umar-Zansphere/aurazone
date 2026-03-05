/**
 * Integration tests for Admin routes (/api/admin)
 * Tests auth guards and key admin endpoints via Supertest
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
    uploadBufferToS3: jest.fn().mockResolvedValue('https://s3.test.com/img.jpg'),
    uploadProductImage: { any: () => (r, s, n) => n() },
}));
jest.mock('../../api/services/admin.service');
jest.mock('../../api/services/session.services', () => ({
    getOrCreateSession: jest.fn().mockResolvedValue({ id: 'db-1', sessionId: 's-1', expiresAt: new Date(Date.now() + 86400000) }),
    validateSession: jest.fn(), migrateSessionToUser: jest.fn(), cleanupExpiredSessions: jest.fn(),
}));

const app = require('../testApp');
const prisma = require('../../config/prisma');
const adminService = require('../../api/services/admin.service');
const { generateAdminToken, generateTestToken, MOCK_ADMIN } = require('../setup');

const adminAuth = (token) => ({ Cookie: `accessToken=${token}` });

describe('Admin Routes', () => {
    let adminToken;

    beforeEach(() => {
        adminToken = generateAdminToken();
        prisma.user.findUnique.mockResolvedValue({ id: MOCK_ADMIN.id, is_active: true, role: 'ADMIN' });
    });

    // ======================== AUTH GUARDS ========================
    describe('Auth Guards', () => {
        it('should return 401 for unauthenticated request', async () => {
            const res = await request(app).get('/api/admin/dashboard');
            expect(res.status).toBe(401);
        });

        it('should return 403 for non-admin user', async () => {
            const userToken = generateTestToken();
            prisma.user.findUnique.mockResolvedValue({ id: 'user-1', is_active: true, role: 'CUSTOMER' });
            const res = await request(app).get('/api/admin/dashboard').set(adminAuth(userToken));
            expect(res.status).toBe(403);
        });
    });

    // ======================== DASHBOARD ========================
    describe('GET /api/admin/dashboard', () => {
        it('should return dashboard data', async () => {
            adminService.getDashboard.mockImplementation((req, res) => res.json({ success: true, data: {} }));
            const res = await request(app).get('/api/admin/dashboard').set(adminAuth(adminToken));
            expect(res.status).toBe(200);
        });
    });

    // ======================== ORDERS ========================
    describe('GET /api/admin/orders', () => {
        it('should list orders', async () => {
            adminService.listOrders.mockImplementation((req, res) => res.json({ success: true, data: [] }));
            const res = await request(app).get('/api/admin/orders').set(adminAuth(adminToken));
            expect(res.status).toBe(200);
        });
    });

    describe('GET /api/admin/orders/:orderId', () => {
        it('should get order by id', async () => {
            adminService.getOrderById.mockImplementation((req, res) => res.json({ success: true }));
            const res = await request(app).get('/api/admin/orders/ord-1').set(adminAuth(adminToken));
            expect(res.status).toBe(200);
        });
    });

    describe('PUT /api/admin/orders/:orderId/status', () => {
        it('should update order status', async () => {
            adminService.updateOrderStatus.mockImplementation((req, res) => res.json({ success: true }));
            const res = await request(app).put('/api/admin/orders/ord-1/status').set(adminAuth(adminToken)).send({ status: 'SHIPPED' });
            expect(res.status).toBe(200);
        });
    });

    describe('DELETE /api/admin/orders/:orderId', () => {
        it('should delete order', async () => {
            adminService.deleteOrder.mockImplementation((req, res) => res.json({ success: true }));
            const res = await request(app).delete('/api/admin/orders/ord-1').set(adminAuth(adminToken));
            expect(res.status).toBe(200);
        });
    });

    // ======================== PAYMENTS ========================
    describe('GET /api/admin/payments', () => {
        it('should list payments', async () => {
            adminService.listPayments.mockImplementation((req, res) => res.json({ success: true, data: [] }));
            const res = await request(app).get('/api/admin/payments').set(adminAuth(adminToken));
            expect(res.status).toBe(200);
        });
    });

    describe('POST /api/admin/orders/:orderId/payments', () => {
        it('should create payment for order', async () => {
            adminService.createPaymentForOrder.mockImplementation((req, res) => res.status(201).json({ success: true }));
            const res = await request(app).post('/api/admin/orders/ord-1/payments').set(adminAuth(adminToken)).send({ amount: 100 });
            expect(res.status).toBe(201);
        });
    });

    describe('GET /api/admin/payments/:paymentId', () => {
        it('should get payment by id', async () => {
            adminService.getPaymentById.mockImplementation((req, res) => res.json({ success: true }));
            const res = await request(app).get('/api/admin/payments/pay-1').set(adminAuth(adminToken));
            expect(res.status).toBe(200);
        });
    });

    describe('DELETE /api/admin/payments/:paymentId', () => {
        it('should delete payment', async () => {
            adminService.deletePaymentById.mockImplementation((req, res) => res.json({ success: true }));
            const res = await request(app).delete('/api/admin/payments/pay-1').set(adminAuth(adminToken));
            expect(res.status).toBe(200);
        });
    });

    // ======================== SHIPMENTS ========================
    describe('GET /api/admin/shipments', () => {
        it('should list shipments', async () => {
            adminService.listShipments.mockImplementation((req, res) => res.json({ success: true, data: [] }));
            const res = await request(app).get('/api/admin/shipments').set(adminAuth(adminToken));
            expect(res.status).toBe(200);
        });
    });

    describe('POST /api/admin/orders/:orderId/shipments', () => {
        it('should create shipment', async () => {
            adminService.createShipmentForOrder.mockImplementation((req, res) => res.status(201).json({ success: true }));
            const res = await request(app).post('/api/admin/orders/ord-1/shipments').set(adminAuth(adminToken)).send({});
            expect(res.status).toBe(201);
        });
    });

    describe('DELETE /api/admin/shipments/:shipmentId', () => {
        it('should delete shipment', async () => {
            adminService.deleteShipmentById.mockImplementation((req, res) => res.json({ success: true }));
            const res = await request(app).delete('/api/admin/shipments/ship-1').set(adminAuth(adminToken));
            expect(res.status).toBe(200);
        });
    });

    // ======================== PRODUCTS ========================
    describe('GET /api/admin/products', () => {
        it('should list products', async () => {
            adminService.listProducts.mockImplementation((req, res) => res.json({ success: true, data: [] }));
            const res = await request(app).get('/api/admin/products').set(adminAuth(adminToken));
            expect(res.status).toBe(200);
        });
    });

    describe('POST /api/admin/products', () => {
        it('should create product', async () => {
            adminService.createProduct.mockImplementation((req, res) => res.status(201).json({ success: true }));
            const res = await request(app).post('/api/admin/products').set(adminAuth(adminToken)).send({ name: 'New', brand: 'B' });
            expect(res.status).toBe(201);
        });
    });

    describe('GET /api/admin/products/:productId', () => {
        it('should get product by id', async () => {
            adminService.getProductById.mockImplementation((req, res) => res.json({ success: true }));
            const res = await request(app).get('/api/admin/products/prod-1').set(adminAuth(adminToken));
            expect(res.status).toBe(200);
        });
    });

    describe('PUT /api/admin/products/:productId', () => {
        it('should update product', async () => {
            adminService.updateProduct.mockImplementation((req, res) => res.json({ success: true }));
            const res = await request(app).put('/api/admin/products/prod-1').set(adminAuth(adminToken)).send({ name: 'Updated' });
            expect(res.status).toBe(200);
        });
    });

    describe('DELETE /api/admin/products/:productId', () => {
        it('should delete product', async () => {
            adminService.deleteProduct.mockImplementation((req, res) => res.json({ success: true }));
            const res = await request(app).delete('/api/admin/products/prod-1').set(adminAuth(adminToken));
            expect(res.status).toBe(200);
        });
    });

    // ======================== VARIANTS ========================
    describe('POST /api/admin/products/:productId/variants', () => {
        it('should create variant', async () => {
            adminService.createVariant.mockImplementation((req, res) => res.status(201).json({ success: true }));
            const res = await request(app).post('/api/admin/products/prod-1/variants').set(adminAuth(adminToken)).send({ size: '42', color: 'Black' });
            expect(res.status).toBe(201);
        });
    });

    describe('PUT /api/admin/variants/:variantId', () => {
        it('should update variant', async () => {
            adminService.updateVariant.mockImplementation((req, res) => res.json({ success: true }));
            const res = await request(app).put('/api/admin/variants/var-1').set(adminAuth(adminToken)).send({ price: 109.99 });
            expect(res.status).toBe(200);
        });
    });

    describe('DELETE /api/admin/variants/:variantId', () => {
        it('should delete variant', async () => {
            adminService.deleteVariant.mockImplementation((req, res) => res.json({ success: true }));
            const res = await request(app).delete('/api/admin/variants/var-1').set(adminAuth(adminToken));
            expect(res.status).toBe(200);
        });
    });

    // ======================== INVENTORY ========================
    describe('GET /api/admin/inventory', () => {
        it('should list inventory', async () => {
            adminService.getInventory.mockImplementation((req, res) => res.json({ success: true, data: [] }));
            const res = await request(app).get('/api/admin/inventory').set(adminAuth(adminToken));
            expect(res.status).toBe(200);
        });
    });

    describe('GET /api/admin/inventory/:variantId', () => {
        it('should get inventory by variant', async () => {
            adminService.getInventoryByVariantId.mockImplementation((req, res) => res.json({ success: true }));
            const res = await request(app).get('/api/admin/inventory/var-1').set(adminAuth(adminToken));
            expect(res.status).toBe(200);
        });
    });

    describe('PUT /api/admin/variants/:variantId/inventory', () => {
        it('should update variant inventory', async () => {
            adminService.updateVariantInventory.mockImplementation((req, res) => res.json({ success: true }));
            const res = await request(app).put('/api/admin/variants/var-1/inventory').set(adminAuth(adminToken)).send({ quantity: 50 });
            expect(res.status).toBe(200);
        });
    });

    describe('POST /api/admin/variants/:variantId/inventory/adjust', () => {
        it('should adjust inventory', async () => {
            adminService.adjustVariantInventory.mockImplementation((req, res) => res.json({ success: true }));
            const res = await request(app).post('/api/admin/variants/var-1/inventory/adjust').set(adminAuth(adminToken)).send({ adjustment: 10 });
            expect(res.status).toBe(200);
        });
    });

    // ======================== ANALYTICS ========================
    describe('GET /api/admin/analytics', () => {
        it('should return analytics', async () => {
            adminService.getAnalytics.mockImplementation((req, res) => res.json({ success: true, data: {} }));
            const res = await request(app).get('/api/admin/analytics').set(adminAuth(adminToken));
            expect(res.status).toBe(200);
        });
    });

    // ======================== LOGS ========================
    describe('GET /api/admin/orders/logs', () => {
        it('should list order logs', async () => {
            adminService.listOrderLogs.mockImplementation((req, res) => res.json({ success: true, data: [] }));
            const res = await request(app).get('/api/admin/orders/logs').set(adminAuth(adminToken));
            expect(res.status).toBe(200);
        });
    });

    describe('GET /api/admin/payments/logs', () => {
        it('should list payment logs', async () => {
            adminService.listPaymentLogs.mockImplementation((req, res) => res.json({ success: true, data: [] }));
            const res = await request(app).get('/api/admin/payments/logs').set(adminAuth(adminToken));
            expect(res.status).toBe(200);
        });
    });

    describe('GET /api/admin/shipments/logs', () => {
        it('should list shipment logs', async () => {
            adminService.listShipmentLogs.mockImplementation((req, res) => res.json({ success: true, data: [] }));
            const res = await request(app).get('/api/admin/shipments/logs').set(adminAuth(adminToken));
            expect(res.status).toBe(200);
        });
    });

    describe('GET /api/admin/inventory/logs', () => {
        it('should list inventory logs', async () => {
            adminService.listInventoryLogs.mockImplementation((req, res) => res.json({ success: true, data: [] }));
            const res = await request(app).get('/api/admin/inventory/logs').set(adminAuth(adminToken));
            expect(res.status).toBe(200);
        });
    });

    // ======================== NOTIFICATIONS ========================
    describe('GET /api/admin/notifications/history', () => {
        it('should get notification history', async () => {
            adminService.getNotificationHistory.mockImplementation((req, res) => res.json({ success: true, data: [] }));
            const res = await request(app).get('/api/admin/notifications/history').set(adminAuth(adminToken));
            expect(res.status).toBe(200);
        });
    });

    describe('POST /api/admin/notifications/broadcast', () => {
        it('should broadcast notification', async () => {
            adminService.broadcastNotification.mockImplementation((req, res) => res.json({ success: true }));
            const res = await request(app).post('/api/admin/notifications/broadcast').set(adminAuth(adminToken)).send({ title: 'Sale!', body: '50% off' });
            expect(res.status).toBe(200);
        });
    });

    describe('PUT /api/admin/notifications/read-all', () => {
        it('should mark all notifications as read', async () => {
            adminService.markAllNotificationsAsRead.mockImplementation((req, res) => res.json({ success: true }));
            const res = await request(app).put('/api/admin/notifications/read-all').set(adminAuth(adminToken));
            expect(res.status).toBe(200);
        });
    });

    describe('GET /api/admin/notifications/preferences', () => {
        it('should get notification preferences', async () => {
            adminService.getNotificationPreferences.mockImplementation((req, res) => res.json({ success: true }));
            const res = await request(app).get('/api/admin/notifications/preferences').set(adminAuth(adminToken));
            expect(res.status).toBe(200);
        });
    });
});
