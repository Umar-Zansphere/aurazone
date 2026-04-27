const request = require('supertest');

const mockUploadBufferToS3 = jest.fn();
const mockBroadcastToAll = jest.fn();
const mockSendEmail = jest.fn();

jest.mock('../api/services/s3.services', () => {
  const actual = jest.requireActual('../api/services/s3.services');
  return {
    ...actual,
    uploadBufferToS3: mockUploadBufferToS3,
  };
});

jest.mock('../api/services/notification.service', () => {
  const actual = jest.requireActual('../api/services/notification.service');
  return {
    ...actual,
    broadcastToAll: mockBroadcastToAll,
  };
});

jest.mock('../config/email', () => ({
  sendEmail: (...args) => mockSendEmail(...args),
}));

const { app } = require('../app');
const {
  prisma,
  clearDatabase,
  createAuthContext,
  createUser,
  createProductFixture,
  createOrderFixture,
  createPaymentFixture,
  createShipmentFixture,
  createTestImageBuffer,
  unique,
} = require('./setup');

jest.setTimeout(60000);

describe('Admin routes integration', () => {
  let auth;

  const asAdmin = (method, url) =>
    request(app)[method](url).set('Authorization', `Bearer ${auth.adminToken}`);

  const asCustomer = (method, url) =>
    request(app)[method](url).set('Authorization', `Bearer ${auth.customerToken}`);

  beforeEach(async () => {
    await clearDatabase();
    auth = await createAuthContext();
    mockUploadBufferToS3.mockReset();
    mockBroadcastToAll.mockReset();
    mockSendEmail.mockReset();
    mockUploadBufferToS3.mockResolvedValue(`https://mock-s3.local/${unique('image')}.jpg`);
    mockBroadcastToAll.mockResolvedValue({ sent: 0, failed: 0, total: 0 });
    mockSendEmail.mockResolvedValue({ id: unique('email') });
  });

  afterAll(async () => {
    await clearDatabase();
    await prisma.$disconnect();
  });

  describe('Access control', () => {
    it('rejects requests without a token', async () => {
      const response = await request(app).get('/api/admin/dashboard');
      expect(response.status).toBe(401);
      expect(response.body.message).toMatch(/Unauthorized/i);
    });

    it('rejects non-admin users', async () => {
      const response = await asCustomer('get', '/api/admin/dashboard');
      expect(response.status).toBe(403);
      expect(response.body.message).toBe('Forbidden: Admin access required');
    });
  });

  describe('Dashboard and analytics', () => {
    it('GET /api/admin/dashboard returns aggregated metrics', async () => {
      const { variant } = await createProductFixture({ quantity: 4, reserved: 1 });
      const order = await createOrderFixture({
        userId: auth.customer.id,
        variantId: variant.id,
        status: 'DELIVERED',
        paymentStatus: 'SUCCESS',
        totalAmount: 3200,
      });
      await createPaymentFixture({
        orderId: order.id,
        status: 'SUCCESS',
        amount: 3200,
      });
      await createShipmentFixture({
        orderId: order.id,
        status: 'DELIVERED',
      });

      const response = await asAdmin('get', '/api/admin/dashboard');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(expect.objectContaining({
        todayRevenue: expect.any(Number),
        todayOrders: expect.any(Number),
        pendingOrders: expect.any(Number),
        revenueTimeseries: expect.any(Array),
        statusBreakdown: expect.any(Object),
        lowStockCount: expect.any(Number),
        activityFeed: expect.any(Array),
      }));
    });

    it('GET /api/admin/analytics validates period', async () => {
      const response = await asAdmin('get', '/api/admin/analytics?period=bad');
      expect(response.status).toBe(400);
      expect(response.body.message).toMatch(/Invalid period/i);
    });

    it('GET /api/admin/analytics returns totals for date range', async () => {
      const { variant } = await createProductFixture();
      await createOrderFixture({
        userId: auth.customer.id,
        variantId: variant.id,
        status: 'DELIVERED',
        paymentStatus: 'SUCCESS',
        totalAmount: 2100,
      });

      const response = await asAdmin('get', '/api/admin/analytics?startDate=2026-01-01&endDate=2026-12-31');

      expect(response.status).toBe(200);
      expect(response.body.totalOrders).toBeGreaterThan(0);
      expect(response.body.totalRevenue).toBeGreaterThanOrEqual(0);
      expect(response.body.revenueTimeseries).toEqual(expect.any(Array));
      expect(response.body.topProducts).toEqual(expect.any(Array));
    });
  });

  describe('Orders endpoints', () => {
    it('GET /api/admin/orders lists orders and GET /api/admin/orders/:orderId returns detail', async () => {
      const { variant } = await createProductFixture();
      const order = await createOrderFixture({
        userId: auth.customer.id,
        variantId: variant.id,
      });

      const listResponse = await asAdmin('get', '/api/admin/orders');
      expect(listResponse.status).toBe(200);
      expect(listResponse.body.orders).toHaveLength(1);
      expect(listResponse.body.orders[0].id).toBe(order.id);

      const detailResponse = await asAdmin('get', `/api/admin/orders/${order.id}`);
      expect(detailResponse.status).toBe(200);
      expect(detailResponse.body.id).toBe(order.id);
      expect(detailResponse.body.items[0].variantId).toBeUndefined();
      expect(detailResponse.body.items[0]).toEqual(expect.objectContaining({
        productName: expect.any(String),
        quantity: expect.any(Number),
      }));
    });

    it('PUT /api/admin/orders/:orderId/status cancels order and releases reserved inventory', async () => {
      const { variant } = await createProductFixture({ quantity: 8, reserved: 0 });
      const order = await createOrderFixture({
        userId: auth.customer.id,
        variantId: variant.id,
        quantity: 3,
        reserveInventory: true,
      });

      const response = await asAdmin('put', `/api/admin/orders/${order.id}/status`)
        .send({ status: 'CANCELLED', note: 'customer requested cancellation' });

      expect(response.status).toBe(200);
      expect(response.body.order.status).toBe('CANCELLED');

      const dbOrder = await prisma.order.findUnique({ where: { id: order.id } });
      const dbInventory = await prisma.inventory.findUnique({ where: { variantId: variant.id } });
      const releaseLog = await prisma.inventoryLog.findFirst({
        where: { orderId: order.id, type: 'RELEASE' },
      });
      const statusLog = await prisma.orderLog.findFirst({
        where: { orderId: order.id, action: 'STATUS_UPDATED' },
      });

      expect(dbOrder.status).toBe('CANCELLED');
      expect(dbInventory.reserved).toBe(0);
      expect(releaseLog).toBeTruthy();
      expect(statusLog).toBeTruthy();
    });

    it('PUT /api/admin/orders/:orderId/payment-status creates/updates payment state', async () => {
      const { variant } = await createProductFixture();
      const order = await createOrderFixture({
        userId: auth.customer.id,
        variantId: variant.id,
        status: 'DELIVERED',
        paymentStatus: 'PENDING',
      });

      const response = await asAdmin('put', `/api/admin/orders/${order.id}/payment-status`)
        .send({ paymentStatus: 'FAILED', note: 'manual failure mark' });

      expect(response.status).toBe(200);
      expect(response.body.order.paymentStatus).toBe('FAILED');

      const payment = await prisma.payment.findFirst({
        where: { orderId: order.id, deletedAt: null },
      });
      const paymentLog = await prisma.paymentLog.findFirst({
        where: { orderId: order.id },
      });

      expect(payment).toBeTruthy();
      expect(payment.status).toBe('FAILED');
      expect(paymentLog).toBeTruthy();
    });

    it('PUT /api/admin/orders/:orderId/shipment updates shipment details', async () => {
      const { variant } = await createProductFixture();
      const order = await createOrderFixture({
        userId: auth.customer.id,
        variantId: variant.id,
      });

      const response = await asAdmin('put', `/api/admin/orders/${order.id}/shipment`)
        .send({
          courierName: 'BlueDart',
          trackingNumber: 'BD-123',
          trackingUrl: 'https://tracking.test/bd-123',
          status: 'RETURNED',
          note: 'return in transit',
        });

      expect(response.status).toBe(200);
      expect(response.body.shipment.status).toBe('RETURNED');
      expect(response.body.shipment.courierName).toBe('BlueDart');

      const shipment = await prisma.orderShipment.findFirst({
        where: { orderId: order.id, deletedAt: null },
      });
      expect(shipment).toBeTruthy();
      expect(shipment.trackingNumber).toBe('BD-123');
    });

    it('PUT /api/admin/orders/:orderId/shipment validates payload', async () => {
      const { variant } = await createProductFixture();
      const order = await createOrderFixture({
        userId: auth.customer.id,
        variantId: variant.id,
      });

      const response = await asAdmin('put', `/api/admin/orders/${order.id}/shipment`).send({});
      expect(response.status).toBe(400);
      expect(response.body.message).toMatch(/No shipment fields provided/i);
    });

    it('DELETE /api/admin/orders/:orderId soft-cancels order and related shipment', async () => {
      const { variant } = await createProductFixture({ quantity: 10 });
      const order = await createOrderFixture({
        userId: auth.customer.id,
        variantId: variant.id,
        quantity: 2,
        reserveInventory: true,
      });
      const shipment = await createShipmentFixture({
        orderId: order.id,
        status: 'PENDING',
      });

      const response = await asAdmin('delete', `/api/admin/orders/${order.id}`)
        .send({ reason: 'fraud check failed' });

      expect(response.status).toBe(200);
      expect(response.body.order.status).toBe('CANCELLED');
      expect(response.body.order.reason).toBe('fraud check failed');

      const dbOrder = await prisma.order.findUnique({ where: { id: order.id } });
      const dbShipment = await prisma.orderShipment.findUnique({ where: { id: shipment.id } });
      const inventory = await prisma.inventory.findUnique({ where: { variantId: variant.id } });

      expect(dbOrder.deletedAt).not.toBeNull();
      expect(dbShipment.deletedAt).not.toBeNull();
      expect(inventory.reserved).toBe(0);
    });

    it('GET /api/admin/orders/logs and /api/admin/orders/:orderId/logs return logs', async () => {
      const { variant } = await createProductFixture();
      const order = await createOrderFixture({
        userId: auth.customer.id,
        variantId: variant.id,
      });

      await asAdmin('put', `/api/admin/orders/${order.id}/status`)
        .send({ status: 'DELIVERED', note: 'manual complete' });

      const listResponse = await asAdmin('get', `/api/admin/orders/logs?orderId=${order.id}`);
      const scopedResponse = await asAdmin('get', `/api/admin/orders/${order.id}/logs`);

      expect(listResponse.status).toBe(200);
      expect(scopedResponse.status).toBe(200);
      expect(listResponse.body.logs.length).toBeGreaterThan(0);
      expect(scopedResponse.body.logs.length).toBeGreaterThan(0);
    });

    it('POST /api/admin/orders/:orderId/payments supports idempotency replay', async () => {
      const { variant } = await createProductFixture();
      const order = await createOrderFixture({
        userId: auth.customer.id,
        variantId: variant.id,
        status: 'DELIVERED',
      });

      const payload = {
        amount: 4998,
        status: 'SUCCESS',
        gateway: 'COD',
        note: 'captured by admin',
      };

      const first = await asAdmin('post', `/api/admin/orders/${order.id}/payments`)
        .set('Idempotency-Key', 'idem-key-001')
        .send(payload);
      const second = await asAdmin('post', `/api/admin/orders/${order.id}/payments`)
        .set('Idempotency-Key', 'idem-key-001')
        .send(payload);

      expect(first.status).toBe(201);
      expect(second.status).toBe(200);
      expect(second.body.message).toMatch(/Idempotency key replayed/i);

      const paymentCount = await prisma.payment.count({
        where: {
          orderId: order.id,
          idempotencyKey: 'idem-key-001',
        },
      });
      expect(paymentCount).toBe(1);
    });

    it('POST /api/admin/orders/:orderId/payments requires idempotency key', async () => {
      const { variant } = await createProductFixture();
      const order = await createOrderFixture({
        userId: auth.customer.id,
        variantId: variant.id,
      });

      const response = await asAdmin('post', `/api/admin/orders/${order.id}/payments`)
        .send({ amount: 1000, status: 'FAILED', gateway: 'COD' });

      expect(response.status).toBe(400);
      expect(response.body.message).toMatch(/idempotencyKey is required/i);
    });

    it('POST /api/admin/orders/:orderId/shipments creates a shipment', async () => {
      const { variant } = await createProductFixture();
      const order = await createOrderFixture({
        userId: auth.customer.id,
        variantId: variant.id,
      });

      const response = await asAdmin('post', `/api/admin/orders/${order.id}/shipments`)
        .send({
          courierName: 'Delhivery',
          trackingNumber: 'DLV-001',
          trackingUrl: 'https://tracking.test/dlv-001',
          status: 'PENDING',
          note: 'shipment created from admin',
        });

      expect(response.status).toBe(201);
      expect(response.body.shipment.order.id).toBe(order.id);
      expect(response.body.shipment.status).toBe('PENDING');

      const log = await prisma.shipmentLog.findFirst({
        where: { orderId: order.id, action: 'CREATED' },
      });
      expect(log).toBeTruthy();
    });

    it('POST /api/admin/orders/:orderId/status-email shares status email and persists sent log', async () => {
      const { variant } = await createProductFixture();
      const order = await createOrderFixture({
        userId: auth.customer.id,
        variantId: variant.id,
        status: 'PENDING',
      });

      const response = await asAdmin('post', `/api/admin/orders/${order.id}/status-email`)
        .send({ note: 'manual share from panel' });

      expect(response.status).toBe(200);
      expect(response.body.sent).toBe(true);
      expect(response.body.emailLog.state).toBe('SENT');

      const statusEmailLog = await prisma.orderStatusEmailLog.findFirst({
        where: { orderId: order.id },
      });
      const orderLog = await prisma.orderLog.findFirst({
        where: { orderId: order.id, action: 'STATUS_EMAIL_SHARED' },
      });

      expect(statusEmailLog).toBeTruthy();
      expect(statusEmailLog.state).toBe('SENT');
      expect(orderLog).toBeTruthy();
      expect(mockSendEmail).toHaveBeenCalled();
    });

    it('POST /api/admin/orders/:orderId/status-email/:emailLogId/resend retries failed status emails', async () => {
      const { variant } = await createProductFixture();
      const order = await createOrderFixture({
        userId: auth.customer.id,
        variantId: variant.id,
        status: 'DELIVERED',
      });

      mockSendEmail.mockRejectedValueOnce(new Error('SMTP unavailable'));

      const firstAttempt = await asAdmin('post', `/api/admin/orders/${order.id}/status-email`)
        .send({ note: 'first try' });

      expect(firstAttempt.status).toBe(200);
      expect(firstAttempt.body.sent).toBe(false);
      expect(firstAttempt.body.emailLog.state).toBe('FAILED');

      mockSendEmail.mockResolvedValueOnce({ id: unique('email-resend') });

      const retry = await asAdmin('post', `/api/admin/orders/${order.id}/status-email/${firstAttempt.body.emailLog.id}/resend`)
        .send({ note: 'retry now' });

      expect(retry.status).toBe(200);
      expect(retry.body.sent).toBe(true);
      expect(retry.body.emailLog.state).toBe('SENT');

      const allLogs = await prisma.orderStatusEmailLog.findMany({
        where: { orderId: order.id },
      });
      const resendOrderLog = await prisma.orderLog.findFirst({
        where: { orderId: order.id, action: 'STATUS_EMAIL_RESENT' },
      });

      expect(allLogs).toHaveLength(2);
      expect(resendOrderLog).toBeTruthy();
    });
  });

  describe('Payments endpoints', () => {
    it('GET /api/admin/payments and GET /api/admin/payments/:paymentId work', async () => {
      const { variant } = await createProductFixture();
      const order = await createOrderFixture({
        userId: auth.customer.id,
        variantId: variant.id,
        status: 'DELIVERED',
      });
      const payment = await createPaymentFixture({
        orderId: order.id,
        status: 'FAILED',
      });

      const listResponse = await asAdmin('get', '/api/admin/payments');
      const detailResponse = await asAdmin('get', `/api/admin/payments/${payment.id}`);

      expect(listResponse.status).toBe(200);
      expect(listResponse.body.payments.length).toBe(1);
      expect(detailResponse.status).toBe(200);
      expect(detailResponse.body.payment.id).toBe(payment.id);
      expect(detailResponse.body.logs).toEqual(expect.any(Array));
    });

    it('PUT /api/admin/payments/:paymentId updates payment and writes logs', async () => {
      const { variant } = await createProductFixture();
      const order = await createOrderFixture({
        userId: auth.customer.id,
        variantId: variant.id,
        status: 'DELIVERED',
      });
      const payment = await createPaymentFixture({
        orderId: order.id,
        status: 'FAILED',
        amount: 4998,
      });

      const response = await asAdmin('put', `/api/admin/payments/${payment.id}`)
        .send({
          status: 'SUCCESS',
          amount: 4998,
          note: 'payment recovered',
          metadata: { source: 'integration-test' },
        });

      expect(response.status).toBe(200);
      expect(response.body.payment.status).toBe('SUCCESS');
      expect(response.body.payment.note).toBe('payment recovered');

      const dbPayment = await prisma.payment.findUnique({ where: { id: payment.id } });
      const paymentLog = await prisma.paymentLog.findFirst({
        where: { paymentId: payment.id, action: 'STATUS_UPDATED' },
      });
      const orderLog = await prisma.orderLog.findFirst({
        where: { orderId: order.id, action: 'PAYMENT_UPDATED' },
      });

      expect(dbPayment.status).toBe('SUCCESS');
      expect(dbPayment.paidAt).not.toBeNull();
      expect(paymentLog).toBeTruthy();
      expect(orderLog).toBeTruthy();
    });

    it('PUT /api/admin/payments/:paymentId validates non-empty updates', async () => {
      const { variant } = await createProductFixture();
      const order = await createOrderFixture({
        userId: auth.customer.id,
        variantId: variant.id,
      });
      const payment = await createPaymentFixture({ orderId: order.id });

      const response = await asAdmin('put', `/api/admin/payments/${payment.id}`).send({});
      expect(response.status).toBe(400);
      expect(response.body.message).toMatch(/No valid payment fields/i);
    });

    it('DELETE /api/admin/payments/:paymentId soft-voids payment', async () => {
      const { variant } = await createProductFixture();
      const order = await createOrderFixture({
        userId: auth.customer.id,
        variantId: variant.id,
      });
      const payment = await createPaymentFixture({ orderId: order.id, status: 'FAILED' });

      const response = await asAdmin('delete', `/api/admin/payments/${payment.id}`)
        .send({ reason: 'duplicate entry' });

      expect(response.status).toBe(200);
      expect(response.body.payment.id).toBe(payment.id);
      expect(response.body.payment.reason).toBe('duplicate entry');

      const dbPayment = await prisma.payment.findUnique({ where: { id: payment.id } });
      const voidLog = await prisma.paymentLog.findFirst({
        where: { paymentId: payment.id, action: 'VOIDED' },
      });

      expect(dbPayment.deletedAt).not.toBeNull();
      expect(voidLog).toBeTruthy();
    });

    it('GET /api/admin/payments/logs and /api/admin/payments/:paymentId/logs return payment logs', async () => {
      const { variant } = await createProductFixture();
      const order = await createOrderFixture({
        userId: auth.customer.id,
        variantId: variant.id,
      });
      const payment = await createPaymentFixture({ orderId: order.id, status: 'FAILED' });

      await asAdmin('put', `/api/admin/payments/${payment.id}`)
        .send({ note: 'adjusted note' });

      const listResponse = await asAdmin('get', `/api/admin/payments/logs?paymentId=${payment.id}`);
      const scopedResponse = await asAdmin('get', `/api/admin/payments/${payment.id}/logs`);

      expect(listResponse.status).toBe(200);
      expect(scopedResponse.status).toBe(200);
      expect(listResponse.body.logs.length).toBeGreaterThan(0);
      expect(scopedResponse.body.logs.length).toBeGreaterThan(0);
    });
  });

  describe('Shipments endpoints', () => {
    it('GET /api/admin/shipments and GET /api/admin/shipments/:shipmentId work', async () => {
      const { variant } = await createProductFixture();
      const order = await createOrderFixture({
        userId: auth.customer.id,
        variantId: variant.id,
      });
      const shipment = await createShipmentFixture({
        orderId: order.id,
        status: 'PENDING',
      });

      const listResponse = await asAdmin('get', '/api/admin/shipments');
      const detailResponse = await asAdmin('get', `/api/admin/shipments/${shipment.id}`);

      expect(listResponse.status).toBe(200);
      expect(listResponse.body.shipments.length).toBe(1);
      expect(detailResponse.status).toBe(200);
      expect(detailResponse.body.shipment.id).toBe(shipment.id);
      expect(detailResponse.body.logs).toEqual(expect.any(Array));
    });

    it('PUT /api/admin/shipments/:shipmentId updates shipment details', async () => {
      const { variant } = await createProductFixture();
      const order = await createOrderFixture({
        userId: auth.customer.id,
        variantId: variant.id,
      });
      const shipment = await createShipmentFixture({
        orderId: order.id,
      });

      const response = await asAdmin('put', `/api/admin/shipments/${shipment.id}`)
        .send({
          status: 'RETURNED',
          courierName: 'Xpress',
          trackingNumber: 'XP-200',
          note: 're-routed',
        });

      expect(response.status).toBe(200);
      expect(response.body.shipment.status).toBe('RETURNED');

      const dbShipment = await prisma.orderShipment.findUnique({ where: { id: shipment.id } });
      const shipmentLog = await prisma.shipmentLog.findFirst({
        where: { shipmentId: shipment.id },
      });

      expect(dbShipment.status).toBe('RETURNED');
      expect(dbShipment.trackingNumber).toBe('XP-200');
      expect(shipmentLog).toBeTruthy();
    });

    it('PUT /api/admin/shipments/:shipmentId validates non-empty updates', async () => {
      const { variant } = await createProductFixture();
      const order = await createOrderFixture({
        userId: auth.customer.id,
        variantId: variant.id,
      });
      const shipment = await createShipmentFixture({ orderId: order.id });

      const response = await asAdmin('put', `/api/admin/shipments/${shipment.id}`).send({});
      expect(response.status).toBe(400);
      expect(response.body.message).toMatch(/No shipment fields provided/i);
    });

    it('DELETE /api/admin/shipments/:shipmentId soft-voids shipment', async () => {
      const { variant } = await createProductFixture();
      const order = await createOrderFixture({
        userId: auth.customer.id,
        variantId: variant.id,
      });
      const shipment = await createShipmentFixture({ orderId: order.id });

      const response = await asAdmin('delete', `/api/admin/shipments/${shipment.id}`)
        .send({ reason: 'label issue' });

      expect(response.status).toBe(200);
      expect(response.body.shipment.id).toBe(shipment.id);

      const dbShipment = await prisma.orderShipment.findUnique({ where: { id: shipment.id } });
      const orderLog = await prisma.orderLog.findFirst({
        where: { orderId: order.id, action: 'SHIPMENT_VOIDED' },
      });

      expect(dbShipment.deletedAt).not.toBeNull();
      expect(orderLog).toBeTruthy();
    });

    it('GET /api/admin/shipments/logs and /api/admin/shipments/:shipmentId/logs return logs', async () => {
      const { variant } = await createProductFixture();
      const order = await createOrderFixture({
        userId: auth.customer.id,
        variantId: variant.id,
      });
      const shipment = await createShipmentFixture({ orderId: order.id });

      await asAdmin('put', `/api/admin/shipments/${shipment.id}`)
        .send({ note: 'metadata only update' });

      const listResponse = await asAdmin('get', `/api/admin/shipments/logs?shipmentId=${shipment.id}`);
      const scopedResponse = await asAdmin('get', `/api/admin/shipments/${shipment.id}/logs`);

      expect(listResponse.status).toBe(200);
      expect(scopedResponse.status).toBe(200);
      expect(listResponse.body.logs.length).toBeGreaterThan(0);
      expect(scopedResponse.body.logs.length).toBeGreaterThan(0);
    });
  });

  describe('Products, variants, images and inventory', () => {
    it('POST /api/admin/products creates product with variants and inventories', async () => {
      const variants = [
        { size: '8', color: 'White', sku: unique('SKU'), price: 1999, quantity: 5, isAvailable: true },
        { size: '9', color: 'Blue', sku: unique('SKU'), price: 2099, quantity: 7, isAvailable: false },
      ];

      const response = await asAdmin('post', '/api/admin/products')
        .field('name', 'Velocity Pro')
        .field('brand', 'AuraZone')
        .field('category', 'RUNNING')
        .field('gender', 'MEN')
        .field('tags', 'new,featured')
        .field('variants', JSON.stringify(variants));

      expect(response.status).toBe(201);
      expect(response.body.product.name).toBe('Velocity Pro');
      expect(response.body.product.variants).toHaveLength(2);
      expect(response.body.product.tags).toEqual(['new', 'featured']);

      const dbProduct = await prisma.product.findUnique({
        where: { id: response.body.product.id },
        include: { variants: { include: { inventory: true } } },
      });
      expect(dbProduct.variants).toHaveLength(2);
      expect(dbProduct.variants.every((v) => Boolean(v.inventory))).toBe(true);
    });

    it('POST /api/admin/products uploads color images once and assigns them to all sizes for that color', async () => {
      const variants = [
        { size: '8', color: 'Black', sku: unique('SKU'), price: 1999, quantity: 5 },
        { size: '9', color: 'Black', sku: unique('SKU'), price: 1999, quantity: 6 },
        { size: '9', color: 'White', sku: unique('SKU'), price: 2099, quantity: 7 },
      ];
      const imageBuffer = await createTestImageBuffer();

      const response = await asAdmin('post', '/api/admin/products')
        .field('name', 'Velocity Color Share')
        .field('brand', 'AuraZone')
        .field('category', 'RUNNING')
        .field('gender', 'MEN')
        .field('variants', JSON.stringify(variants))
        .field('colorImageGroups', JSON.stringify([{ fieldName: 'colorImages_0', colors: ['Black'] }]))
        .attach('colorImages_0', imageBuffer, { filename: 'black.png', contentType: 'image/png' });

      expect(response.status).toBe(201);
      expect(mockUploadBufferToS3).toHaveBeenCalledTimes(1);
      expect(mockUploadBufferToS3.mock.calls[0][1]).toMatch(/\/colors\/black$/);

      const dbProduct = await prisma.product.findUnique({
        where: { id: response.body.product.id },
        include: {
          variants: {
            include: { images: true },
            orderBy: { size: 'asc' },
          },
        },
      });

      const blackVariants = dbProduct.variants.filter((variant) => variant.color === 'Black');
      const whiteVariant = dbProduct.variants.find((variant) => variant.color === 'White');
      const blackImageUrls = blackVariants.flatMap((variant) => variant.images.map((image) => image.url));

      expect(blackVariants).toHaveLength(2);
      expect(blackVariants.every((variant) => variant.images.length === 1)).toBe(true);
      expect(new Set(blackImageUrls).size).toBe(1);
      expect(whiteVariant.images).toHaveLength(0);
    });

    it('GET /api/admin/products validates sort and supports product detail', async () => {
      const { product } = await createProductFixture();

      const invalidResponse = await asAdmin('get', '/api/admin/products?sort=invalid');
      expect(invalidResponse.status).toBe(400);

      const listResponse = await asAdmin('get', '/api/admin/products?sort=newest');
      expect(listResponse.status).toBe(200);
      expect(listResponse.body.products.length).toBeGreaterThan(0);

      const detailResponse = await asAdmin('get', `/api/admin/products/${product.id}`);
      expect(detailResponse.status).toBe(200);
      expect(detailResponse.body.id).toBe(product.id);
    });

    it('PUT /api/admin/products/:productId updates product fields', async () => {
      const { product } = await createProductFixture();

      const response = await asAdmin('put', `/api/admin/products/${product.id}`)
        .send({
          name: 'Updated Name',
          isActive: 'false',
          isFeatured: 'true',
          tags: ['updated', 'tag'],
        });

      expect(response.status).toBe(200);
      expect(response.body.product.name).toBe('Updated Name');
      expect(response.body.product.isActive).toBe(false);
      expect(response.body.product.isFeatured).toBe(true);

      const dbProduct = await prisma.product.findUnique({ where: { id: product.id } });
      expect(dbProduct.tags).toEqual(['updated', 'tag']);
    });

    it('POST /api/admin/products/:productId/variants creates variant and can copy images', async () => {
      const { product, variant } = await createProductFixture();
      await prisma.productImage.create({
        data: {
          variantId: variant.id,
          url: 'https://cdn.test.local/source.jpg',
          altText: 'source',
          position: 0,
          isPrimary: true,
        },
      });

      const response = await asAdmin('post', `/api/admin/products/${product.id}/variants`)
        .send({
          size: '10',
          color: 'Green',
          sku: unique('SKU'),
          price: 2299,
          quantity: 6,
          copyImagesFromVariantId: variant.id,
        });

      expect(response.status).toBe(201);
      expect(response.body.variant.size).toBe('10');
      expect(response.body.variant.images.length).toBeGreaterThan(0);

      const dbInventory = await prisma.inventory.findUnique({
        where: { variantId: response.body.variant.id },
      });
      expect(dbInventory.quantity).toBe(6);
    });

    it('PUT /api/admin/variants/:variantId and DELETE /api/admin/variants/:variantId work', async () => {
      const { variant } = await createProductFixture();

      const updateResponse = await asAdmin('put', `/api/admin/variants/${variant.id}`)
        .send({
          price: 2599,
          compareAtPrice: 2899,
          isAvailable: 'false',
          color: 'Red',
        });
      expect(updateResponse.status).toBe(200);
      expect(updateResponse.body.variant.price).toBe(2599);
      expect(updateResponse.body.variant.isAvailable).toBe(false);

      const deleteResponse = await asAdmin('delete', `/api/admin/variants/${variant.id}`);
      expect(deleteResponse.status).toBe(200);

      const deletedVariant = await prisma.productVariant.findUnique({ where: { id: variant.id } });
      expect(deletedVariant).toBeNull();
    });

    it('PUT /api/admin/variants/:variantId/inventory updates quantity and writes inventory log', async () => {
      const { variant } = await createProductFixture({ quantity: 5, reserved: 2 });

      const response = await asAdmin('put', `/api/admin/variants/${variant.id}/inventory`)
        .send({ quantity: 9, note: 'manual restock' });

      expect(response.status).toBe(200);
      expect(response.body.inventory.quantity).toBe(9);
      expect(response.body.inventory.reserved).toBe(2);

      const log = await prisma.inventoryLog.findFirst({
        where: { variantId: variant.id, type: 'RESTOCK' },
      });
      expect(log).toBeTruthy();
    });

    it('PUT /api/admin/variants/:variantId/inventory validates reserved threshold', async () => {
      const { variant } = await createProductFixture({ quantity: 7, reserved: 4 });

      const response = await asAdmin('put', `/api/admin/variants/${variant.id}/inventory`)
        .send({ quantity: 3 });

      expect(response.status).toBe(400);
      expect(response.body.message).toMatch(/>= reserved stock/i);
    });

    it('POST /api/admin/variants/:variantId/inventory/adjust applies operation and logs change', async () => {
      const { variant } = await createProductFixture({ quantity: 10, reserved: 1 });
      const order = await createOrderFixture({
        userId: auth.customer.id,
        variantId: variant.id,
      });

      const response = await asAdmin('post', `/api/admin/variants/${variant.id}/inventory/adjust`)
        .send({
          operation: 'HOLD',
          quantity: 2,
          orderId: order.id,
          note: 'reserve for replacement',
        });

      expect(response.status).toBe(200);
      expect(response.body.operation).toBe('HOLD');
      expect(response.body.inventory.inventory.reserved).toBe(3);

      const holdLog = await prisma.inventoryLog.findFirst({
        where: { variantId: variant.id, orderId: order.id, type: 'HOLD' },
      });
      expect(holdLog).toBeTruthy();
    });

    it('POST /api/admin/variants/:variantId/inventory/adjust validates operation payload', async () => {
      const { variant } = await createProductFixture();

      const response = await asAdmin('post', `/api/admin/variants/${variant.id}/inventory/adjust`)
        .send({ operation: 'RESTOCK', quantity: 0 });

      expect(response.status).toBe(400);
      expect(response.body.message).toMatch(/greater than 0/i);
    });

    it('GET /api/admin/inventory, GET /api/admin/inventory/:variantId and GET /api/admin/inventory/logs work', async () => {
      const low = await createProductFixture({ quantity: 3 });
      const high = await createProductFixture({ quantity: 12 });

      await prisma.inventoryLog.create({
        data: {
          variantId: low.variant.id,
          quantity: 2,
          type: 'RESTOCK',
          performedBy: auth.admin.id,
          note: 'seed log',
        },
      });

      const listResponse = await asAdmin('get', '/api/admin/inventory?lowStockOnly=true');
      const detailResponse = await asAdmin('get', `/api/admin/inventory/${low.variant.id}`);
      const logsResponse = await asAdmin('get', '/api/admin/inventory/logs');

      expect(listResponse.status).toBe(200);
      expect(listResponse.body.inventories).toHaveLength(1);
      expect(listResponse.body.inventories[0].variantId).toBe(low.variant.id);
      expect(listResponse.body.inventories[0].variantId).not.toBe(high.variant.id);

      expect(detailResponse.status).toBe(200);
      expect(detailResponse.body.variantId).toBe(low.variant.id);
      expect(detailResponse.body.logs.length).toBeGreaterThan(0);

      expect(logsResponse.status).toBe(200);
      expect(logsResponse.body.logs.length).toBeGreaterThan(0);
    });

    it('POST /api/admin/variants/:variantId/images creates image with external upload mocked', async () => {
      const { variant } = await createProductFixture();
      const imageBuffer = await createTestImageBuffer();

      const response = await asAdmin('post', `/api/admin/variants/${variant.id}/images`)
        .attach('image', imageBuffer, { filename: 'variant.png', contentType: 'image/png' })
        .field('isPrimary', 'true')
        .field('position', '0')
        .field('altText', 'primary image');

      expect(response.status).toBe(201);
      expect(response.body.image.isPrimary).toBe(true);
      expect(mockUploadBufferToS3).toHaveBeenCalledTimes(1);

      const dbImage = await prisma.productImage.findUnique({
        where: { id: response.body.image.id },
      });
      expect(dbImage.url).toMatch(/^https:\/\/mock-s3\.local\//);
    });

    it('POST /api/admin/variants/:variantId/images/copy copies images from source variant', async () => {
      const { product, variant: sourceVariant } = await createProductFixture();
      const targetVariant = await prisma.productVariant.create({
        data: {
          productId: product.id,
          size: '11',
          color: 'Grey',
          sku: unique('SKU'),
          price: 2199,
        },
      });
      await prisma.inventory.create({
        data: { variantId: targetVariant.id, quantity: 4 },
      });

      await prisma.productImage.createMany({
        data: [
          {
            variantId: sourceVariant.id,
            url: 'https://cdn.test.local/1.jpg',
            altText: 'first',
            position: 0,
            isPrimary: true,
          },
          {
            variantId: sourceVariant.id,
            url: 'https://cdn.test.local/2.jpg',
            altText: 'second',
            position: 1,
            isPrimary: false,
          },
        ],
      });

      const response = await asAdmin('post', `/api/admin/variants/${targetVariant.id}/images/copy`)
        .send({ sourceVariantId: sourceVariant.id });

      expect(response.status).toBe(201);
      expect(response.body.images).toHaveLength(2);

      const copiedCount = await prisma.productImage.count({
        where: { variantId: targetVariant.id },
      });
      expect(copiedCount).toBe(2);
    });

    it('PUT /api/admin/images/:imageId updates image and DELETE /api/admin/images/:imageId removes it', async () => {
      const { variant } = await createProductFixture();
      const first = await prisma.productImage.create({
        data: {
          variantId: variant.id,
          url: 'https://cdn.test.local/a.jpg',
          altText: 'A',
          position: 0,
          isPrimary: true,
        },
      });
      const second = await prisma.productImage.create({
        data: {
          variantId: variant.id,
          url: 'https://cdn.test.local/b.jpg',
          altText: 'B',
          position: 1,
          isPrimary: false,
        },
      });

      const updateResponse = await asAdmin('put', `/api/admin/images/${second.id}`)
        .send({ isPrimary: true, altText: 'Now primary', position: 3 });
      expect(updateResponse.status).toBe(200);
      expect(updateResponse.body.image.isPrimary).toBe(true);
      expect(updateResponse.body.image.position).toBe(3);

      const dbFirst = await prisma.productImage.findUnique({ where: { id: first.id } });
      const dbSecond = await prisma.productImage.findUnique({ where: { id: second.id } });
      expect(dbFirst.isPrimary).toBe(false);
      expect(dbSecond.isPrimary).toBe(true);

      const deleteResponse = await asAdmin('delete', `/api/admin/images/${second.id}`);
      expect(deleteResponse.status).toBe(200);
      const deleted = await prisma.productImage.findUnique({ where: { id: second.id } });
      expect(deleted).toBeNull();
    });

    it('DELETE /api/admin/products/:productId deletes product tree', async () => {
      const { product } = await createProductFixture();

      const response = await asAdmin('delete', `/api/admin/products/${product.id}`);
      expect(response.status).toBe(200);

      const dbProduct = await prisma.product.findUnique({ where: { id: product.id } });
      expect(dbProduct).toBeNull();
    });
  });

  describe('Notifications endpoints', () => {
    it('GET history, mark single read, and mark all read work', async () => {
      const ownA = await prisma.notificationHistory.create({
        data: {
          userId: auth.admin.id,
          title: 'A',
          body: 'Alpha',
          isRead: false,
        },
      });
      await prisma.notificationHistory.create({
        data: {
          userId: auth.admin.id,
          title: 'B',
          body: 'Beta',
          isRead: false,
        },
      });
      await prisma.notificationHistory.create({
        data: {
          userId: auth.customer.id,
          title: 'Other',
          body: 'Not mine',
          isRead: false,
        },
      });

      const listResponse = await asAdmin('get', '/api/admin/notifications/history');
      expect(listResponse.status).toBe(200);
      expect(listResponse.body.notifications).toHaveLength(2);
      expect(listResponse.body.unreadCount).toBe(2);

      const markOne = await asAdmin('put', `/api/admin/notifications/${ownA.id}/read`);
      expect(markOne.status).toBe(200);

      const markAll = await asAdmin('put', '/api/admin/notifications/read-all');
      expect(markAll.status).toBe(200);

      const unread = await prisma.notificationHistory.count({
        where: { userId: auth.admin.id, isRead: false },
      });
      expect(unread).toBe(0);
    });

    it('subscribe/unsubscribe endpoints manage push subscriptions', async () => {
      const endpoint = `https://push.test/${unique('endpoint')}`;

      const subscribeResponse = await asAdmin('post', '/api/admin/notifications/subscribe')
        .send({
          endpoint,
          keys: {
            p256dh: 'pkey',
            auth: 'akey',
          },
          userAgent: 'jest-agent',
        });
      expect(subscribeResponse.status).toBe(200);

      const created = await prisma.pushSubscription.findUnique({ where: { endpoint } });
      expect(created).toBeTruthy();
      expect(created.userId).toBe(auth.admin.id);

      const unsubscribeResponse = await asAdmin('delete', '/api/admin/notifications/unsubscribe')
        .send({ endpoint });
      expect(unsubscribeResponse.status).toBe(200);

      const removedCount = await prisma.pushSubscription.count({
        where: { endpoint, userId: auth.admin.id },
      });
      expect(removedCount).toBe(0);
    });

    it('GET/PUT notification preferences create and update user preferences', async () => {
      const getResponse = await asAdmin('get', '/api/admin/notifications/preferences');
      expect(getResponse.status).toBe(200);
      expect(getResponse.body).toEqual(expect.objectContaining({
        newOrders: true,
        orderStatusChange: true,
        lowStock: true,
        otherEvents: true,
      }));

      const putResponse = await asAdmin('put', '/api/admin/notifications/preferences')
        .send({
          newOrders: false,
          orderStatusChange: false,
          lowStock: true,
          otherEvents: false,
        });
      expect(putResponse.status).toBe(200);
      expect(putResponse.body.preferences).toEqual({
        newOrders: false,
        orderStatusChange: false,
        lowStock: true,
        otherEvents: false,
      });

      const dbPreferences = await prisma.notificationPreferences.findUnique({
        where: { userId: auth.admin.id },
      });
      expect(dbPreferences.newOrders).toBe(false);
      expect(dbPreferences.otherEvents).toBe(false);
    });

    it('PUT /api/admin/notifications/preferences validates payload', async () => {
      const response = await asAdmin('put', '/api/admin/notifications/preferences').send({});
      expect(response.status).toBe(400);
      expect(response.body.message).toMatch(/No valid preferences provided/i);
    });

    it('POST /api/admin/notifications/broadcast records notification history for recipients', async () => {
      const userA = await createUser({ role: 'CUSTOMER', fullName: 'Recipient A' });
      const userB = await createUser({ role: 'CUSTOMER', fullName: 'Recipient B' });

      await prisma.pushSubscription.createMany({
        data: [
          {
            endpoint: `https://push.test/${unique('sub')}`,
            p256dh: 'p1',
            auth: 'a1',
            userId: userA.id,
          },
          {
            endpoint: `https://push.test/${unique('sub')}`,
            p256dh: 'p2',
            auth: 'a2',
            userId: userA.id,
          },
          {
            endpoint: `https://push.test/${unique('sub')}`,
            p256dh: 'p3',
            auth: 'a3',
            userId: userB.id,
          },
        ],
      });

      mockBroadcastToAll.mockResolvedValueOnce({ sent: 2, failed: 1, total: 3 });

      const response = await asAdmin('post', '/api/admin/notifications/broadcast')
        .send({
          title: 'Admin Notice',
          body: 'Service update at 7PM',
          url: '/admin/updates',
        });

      expect(response.status).toBe(200);
      expect(response.body.sentCount).toBe(2);
      expect(response.body.failedCount).toBe(1);
      expect(response.body.totalSubscriptions).toBe(3);
      expect(response.body.totalRecipients).toBe(2);
      expect(mockBroadcastToAll).toHaveBeenCalledTimes(1);

      const savedForA = await prisma.notificationHistory.count({
        where: { userId: userA.id, title: 'Admin Notice' },
      });
      const savedForB = await prisma.notificationHistory.count({
        where: { userId: userB.id, title: 'Admin Notice' },
      });
      expect(savedForA).toBe(1);
      expect(savedForB).toBe(1);
    });
  });
});
