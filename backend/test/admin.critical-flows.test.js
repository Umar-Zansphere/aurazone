const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');

const SERVICE_PATH = path.resolve(__dirname, '..', 'api', 'services', 'admin.service.js');
const PRISMA_PATH = path.resolve(__dirname, '..', 'config', 'prisma.js');
const NOW = new Date('2026-02-22T10:00:00.000Z');

const createReq = ({
  params = {},
  body = {},
  query = {},
  user = { id: 'admin-user-1' },
  headers = {},
} = {}) => {
  const normalizedHeaders = Object.entries(headers).reduce((acc, [key, value]) => {
    acc[key.toLowerCase()] = value;
    return acc;
  }, {});

  return {
    params,
    body,
    query,
    user,
    headers: normalizedHeaders,
    get(name) {
      return normalizedHeaders[name.toLowerCase()];
    },
  };
};

const createRes = () => {
  const state = {
    statusCode: 200,
    payload: null,
  };

  return {
    status(code) {
      state.statusCode = code;
      return this;
    },
    json(payload) {
      state.payload = payload;
      return this;
    },
    get statusCode() {
      return state.statusCode;
    },
    get payload() {
      return state.payload;
    },
  };
};

const expectServiceError = async (run, expectedStatusCode, expectedMessagePart) => {
  await assert.rejects(run, (error) => {
    assert.equal(error.statusCode, expectedStatusCode);
    if (expectedMessagePart) {
      assert.match(error.message, expectedMessagePart);
    }
    return true;
  });
};

const loadAdminService = (mockPrisma) => {
  delete require.cache[SERVICE_PATH];
  delete require.cache[PRISMA_PATH];

  const originalLoad = Module._load;

  Module._load = function patchedLoad(request, parent, isMain) {
    const resolved = Module._resolveFilename(request, parent, isMain);
    if (resolved === PRISMA_PATH) {
      return mockPrisma;
    }
    return originalLoad.call(this, request, parent, isMain);
  };

  try {
    return require(SERVICE_PATH);
  } finally {
    Module._load = originalLoad;
  }
};

const baseOrderSummary = (overrides = {}) => ({
  id: 'order-1',
  orderNumber: 'ORD-1001',
  status: 'PENDING',
  paymentStatus: 'PENDING',
  paymentMethod: 'COD',
  totalAmount: 1000,
  deletedAt: null,
  deleteReason: null,
  createdAt: NOW,
  user: null,
  orderAddress: null,
  items: [{ quantity: 1 }],
  shipments: [],
  ...overrides,
});

const baseOrderForPaymentView = (overrides = {}) => ({
  id: 'order-1',
  orderNumber: 'ORD-1001',
  status: 'PAID',
  paymentStatus: 'SUCCESS',
  totalAmount: 1000,
  createdAt: NOW,
  user: null,
  orderAddress: null,
  ...overrides,
});

const basePayment = (overrides = {}) => ({
  id: 'payment-1',
  orderId: 'order-1',
  gateway: 'COD',
  gatewayOrderId: null,
  gatewayPaymentId: null,
  externalReference: null,
  idempotencyKey: 'idem-1',
  amount: 1000,
  status: 'SUCCESS',
  paidAt: NOW,
  note: null,
  metadata: null,
  deletedAt: null,
  deleteReason: null,
  createdAt: NOW,
  updatedAt: NOW,
  order: baseOrderForPaymentView(),
  ...overrides,
});

const baseShipment = (overrides = {}) => ({
  id: 'ship-1',
  orderId: 'order-1',
  courierName: 'BlueDart',
  trackingNumber: 'TRK-1',
  trackingUrl: 'https://tracking.example/TRK-1',
  status: 'SHIPPED',
  shippedAt: NOW,
  deletedAt: null,
  deleteReason: null,
  createdAt: NOW,
  order: {
    id: 'order-1',
    orderNumber: 'ORD-1001',
    status: 'SHIPPED',
    paymentStatus: 'SUCCESS',
    createdAt: NOW,
  },
  ...overrides,
});

test('updateOrderPaymentStatus uses aggregate sync and avoids direct order-level drift', async () => {
  const orderUpdateCalls = [];
  const paymentUpdateCalls = [];
  const orderLogCalls = [];

  const findOrderQueue = [
    {
      id: 'order-1',
      orderNumber: 'ORD-1001',
      status: 'PENDING',
      paymentStatus: 'PENDING',
      paymentMethod: 'COD',
      razorpayOrderId: null,
      razorpayPaymentId: null,
      totalAmount: 1000,
      deletedAt: null,
      payments: [{
        id: 'payment-1',
        gateway: 'COD',
        gatewayOrderId: null,
        gatewayPaymentId: null,
        externalReference: null,
        amount: 1000,
        status: 'PENDING',
        paidAt: null,
        note: null,
      }],
    },
    {
      id: 'order-1',
      orderNumber: 'ORD-1001',
      status: 'PENDING',
      paymentStatus: 'PENDING',
    },
    baseOrderSummary({
      status: 'PAID',
      paymentStatus: 'SUCCESS',
    }),
  ];

  const tx = {
    order: {
      findUnique: async () => {
        const next = findOrderQueue.shift();
        if (!next) {
          throw new Error('Unexpected tx.order.findUnique call');
        }
        return next;
      },
      update: async (args) => {
        orderUpdateCalls.push(args);
        return {
          id: 'order-1',
          orderNumber: 'ORD-1001',
          status: args.data.status || 'PENDING',
          paymentStatus: args.data.paymentStatus || 'PENDING',
        };
      },
    },
    payment: {
      update: async (args) => {
        paymentUpdateCalls.push(args);
        return {
          id: 'payment-1',
          amount: 1000,
          status: args.data.status,
        };
      },
      create: async () => {
        throw new Error('create should not be called in this scenario');
      },
      findMany: async () => [{ status: 'SUCCESS' }, { status: 'FAILED' }],
    },
    orderLog: {
      create: async (args) => {
        orderLogCalls.push(args);
        return args.data;
      },
    },
    paymentLog: {
      create: async () => ({ id: 'plog-1' }),
    },
  };

  const prisma = {
    $transaction: async (callback) => callback(tx),
  };

  const adminService = loadAdminService(prisma);

  const req = createReq({
    params: { orderId: 'order-1' },
    body: {
      paymentStatus: 'FAILED',
      note: 'manual status adjustment',
    },
  });
  const res = createRes();

  await adminService.updateOrderPaymentStatus(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(paymentUpdateCalls[0].data.status, 'FAILED');
  assert.equal(orderUpdateCalls.length, 1);
  assert.equal(orderUpdateCalls[0].data.paymentStatus, 'SUCCESS');
  assert.equal(res.payload.order.paymentStatus, 'SUCCESS');
  assert.equal(orderLogCalls[orderLogCalls.length - 1].data.toPaymentStatus, 'SUCCESS');
});

test('createPaymentForOrder requires idempotencyKey', async () => {
  let transactionTouched = false;
  const prisma = {
    $transaction: async () => {
      transactionTouched = true;
      throw new Error('Should not reach transaction');
    },
  };

  const adminService = loadAdminService(prisma);
  const req = createReq({
    params: { orderId: 'order-1' },
    body: { amount: 500, status: 'SUCCESS' },
  });

  await expectServiceError(
    async () => adminService.createPaymentForOrder(req, createRes()),
    400,
    /idempotencyKey is required/
  );

  assert.equal(transactionTouched, false);
});

test('createPaymentForOrder rejects RAZORPAY SUCCESS without gateway payment reference', async () => {
  const tx = {
    order: {
      findUnique: async () => ({
        id: 'order-1',
        orderNumber: 'ORD-1001',
        status: 'PENDING',
        paymentStatus: 'PENDING',
        paymentMethod: 'RAZORPAY',
        razorpayOrderId: 'razor-order-1',
        razorpayPaymentId: null,
        deletedAt: null,
      }),
    },
  };

  const prisma = {
    $transaction: async (callback) => callback(tx),
  };

  const adminService = loadAdminService(prisma);
  const req = createReq({
    params: { orderId: 'order-1' },
    body: {
      amount: 999,
      status: 'SUCCESS',
      gateway: 'RAZORPAY',
      idempotencyKey: 'idem-razorpay-1',
    },
  });

  await expectServiceError(
    async () => adminService.createPaymentForOrder(req, createRes()),
    400,
    /gatewayPaymentId is required/
  );
});

test('createPaymentForOrder returns existing record on idempotent replay', async () => {
  let createCalled = false;
  const orderFindQueue = [
    {
      id: 'order-1',
      orderNumber: 'ORD-1001',
      status: 'PAID',
      paymentStatus: 'SUCCESS',
      paymentMethod: 'COD',
      razorpayOrderId: null,
      razorpayPaymentId: null,
      deletedAt: null,
    },
    {
      id: 'order-1',
      orderNumber: 'ORD-1001',
      status: 'PAID',
      paymentStatus: 'SUCCESS',
    },
  ];

  const existingPayment = basePayment({
    id: 'payment-existing',
    idempotencyKey: 'idem-replay-1',
    amount: 700,
    gateway: 'COD',
    status: 'SUCCESS',
  });

  const tx = {
    order: {
      findUnique: async () => {
        const next = orderFindQueue.shift();
        if (!next) {
          throw new Error('Unexpected tx.order.findUnique call');
        }
        return next;
      },
      update: async () => {
        throw new Error('Order update is not expected in this replay path');
      },
    },
    payment: {
      findFirst: async () => existingPayment,
      findUnique: async () => existingPayment,
      create: async () => {
        createCalled = true;
        throw new Error('create should not be called on replay');
      },
      findMany: async () => [{ status: 'SUCCESS' }],
    },
  };

  const prisma = {
    $transaction: async (callback) => callback(tx),
  };

  const adminService = loadAdminService(prisma);
  const req = createReq({
    params: { orderId: 'order-1' },
    headers: { 'Idempotency-Key': 'idem-replay-1' },
    body: {
      amount: 700,
      status: 'SUCCESS',
      gateway: 'COD',
    },
  });
  const res = createRes();

  await adminService.createPaymentForOrder(req, res);

  assert.equal(res.statusCode, 200);
  assert.match(res.payload.message, /Idempotency key replayed/);
  assert.equal(res.payload.payment.id, 'payment-existing');
  assert.equal(createCalled, false);
});

test('createPaymentForOrder blocks idempotency replay with mismatched payload', async () => {
  const tx = {
    order: {
      findUnique: async () => ({
        id: 'order-1',
        orderNumber: 'ORD-1001',
        status: 'PAID',
        paymentStatus: 'SUCCESS',
        paymentMethod: 'COD',
        razorpayOrderId: null,
        razorpayPaymentId: null,
        deletedAt: null,
      }),
    },
    payment: {
      findFirst: async () => basePayment({
        id: 'payment-existing',
        idempotencyKey: 'idem-conflict-1',
        amount: 700,
        status: 'SUCCESS',
      }),
    },
  };

  const prisma = {
    $transaction: async (callback) => callback(tx),
  };

  const adminService = loadAdminService(prisma);
  const req = createReq({
    params: { orderId: 'order-1' },
    headers: { 'Idempotency-Key': 'idem-conflict-1' },
    body: {
      amount: 900,
      status: 'SUCCESS',
      gateway: 'COD',
    },
  });

  await expectServiceError(
    async () => adminService.createPaymentForOrder(req, createRes()),
    409,
    /idempotencyKey already exists with different values/
  );
});

test('deletePaymentById soft-voids payment and does not hard-delete', async () => {
  let deleteCalled = false;
  const paymentUpdateCalls = [];
  const orderUpdateCalls = [];
  const paymentFindQueue = [
    basePayment({
      id: 'payment-1',
      status: 'SUCCESS',
      deletedAt: null,
      order: baseOrderForPaymentView({
        status: 'PAID',
        paymentStatus: 'SUCCESS',
      }),
    }),
    basePayment({
      id: 'payment-1',
      status: 'SUCCESS',
      deletedAt: NOW,
      deleteReason: 'void test',
      order: baseOrderForPaymentView({
        status: 'PENDING',
        paymentStatus: 'PENDING',
      }),
    }),
  ];

  const tx = {
    payment: {
      findUnique: async () => {
        const next = paymentFindQueue.shift();
        if (!next) {
          throw new Error('Unexpected tx.payment.findUnique call');
        }
        return next;
      },
      update: async (args) => {
        paymentUpdateCalls.push(args);
        return args;
      },
      delete: async () => {
        deleteCalled = true;
      },
      findMany: async () => [],
    },
    paymentLog: {
      create: async () => ({ id: 'plog-1' }),
    },
    order: {
      findUnique: async () => ({
        id: 'order-1',
        orderNumber: 'ORD-1001',
        status: 'PAID',
        paymentStatus: 'SUCCESS',
      }),
      update: async (args) => {
        orderUpdateCalls.push(args);
        return args;
      },
    },
    orderLog: {
      create: async () => ({ id: 'olog-1' }),
    },
  };

  const prisma = {
    $transaction: async (callback) => callback(tx),
  };

  const adminService = loadAdminService(prisma);
  const req = createReq({
    params: { paymentId: 'payment-1' },
    body: { reason: 'void test' },
  });
  const res = createRes();

  await adminService.deletePaymentById(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.message, 'Payment voided successfully');
  assert.equal(deleteCalled, false);
  assert.equal(paymentUpdateCalls.length, 1);
  assert.equal(paymentUpdateCalls[0].where.id, 'payment-1');
  assert.ok(paymentUpdateCalls[0].data.deletedAt instanceof Date);
  assert.equal(orderUpdateCalls.length, 1);
  assert.equal(orderUpdateCalls[0].data.paymentStatus, 'PENDING');
});

test('deleteOrder cancels and soft-deletes related shipments instead of hard delete', async () => {
  let hardDeleteCalled = false;
  const shipmentUpdateManyCalls = [];
  const orderUpdateCalls = [];

  const prisma = {
    order: {
      findUnique: async () => baseOrderSummary({
        status: 'PAID',
        paymentStatus: 'SUCCESS',
        items: [{ quantity: 1 }, { quantity: 2 }],
      }),
    },
    $transaction: async (callback) => callback({
      orderShipment: {
        findMany: async () => [
          { id: 'ship-1', status: 'PENDING', courierName: null, trackingNumber: null, trackingUrl: null },
          { id: 'ship-2', status: 'SHIPPED', courierName: 'BlueDart', trackingNumber: 'TRK2', trackingUrl: null },
        ],
        updateMany: async (args) => {
          shipmentUpdateManyCalls.push(args);
          return { count: 2 };
        },
      },
      shipmentLog: {
        create: async () => ({ id: 'slog-1' }),
      },
      order: {
        update: async (args) => {
          orderUpdateCalls.push(args);
          return args;
        },
        delete: async () => {
          hardDeleteCalled = true;
        },
        findUnique: async () => baseOrderSummary({
          status: 'CANCELLED',
          paymentStatus: 'SUCCESS',
          deletedAt: NOW,
          deleteReason: 'customer request',
        }),
      },
      orderLog: {
        create: async () => ({ id: 'olog-1' }),
      },
    }),
  };

  const adminService = loadAdminService(prisma);
  const req = createReq({
    params: { orderId: 'order-1' },
    body: { reason: 'customer request' },
  });
  const res = createRes();

  await adminService.deleteOrder(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.message, 'Order cancelled successfully');
  assert.equal(hardDeleteCalled, false);
  assert.equal(orderUpdateCalls.length, 1);
  assert.equal(orderUpdateCalls[0].data.status, 'CANCELLED');
  assert.equal(shipmentUpdateManyCalls.length, 1);
  assert.ok(shipmentUpdateManyCalls[0].data.deletedAt instanceof Date);
});

test('deleteShipmentById soft-voids shipment and updates inferred order status', async () => {
  let hardDeleteCalled = false;
  const shipmentUpdateCalls = [];
  const orderUpdateCalls = [];
  const shipmentFindUniqueQueue = [
    baseShipment({
      id: 'ship-1',
      status: 'SHIPPED',
      deletedAt: null,
      order: {
        id: 'order-1',
        orderNumber: 'ORD-1001',
        status: 'SHIPPED',
        paymentStatus: 'SUCCESS',
        createdAt: NOW,
      },
    }),
    baseShipment({
      id: 'ship-1',
      status: 'SHIPPED',
      deletedAt: NOW,
      deleteReason: 'wrong shipment',
      order: {
        id: 'order-1',
        orderNumber: 'ORD-1001',
        status: 'PENDING',
        paymentStatus: 'SUCCESS',
        createdAt: NOW,
      },
    }),
  ];

  const prisma = {
    $transaction: async (callback) => callback({
      orderShipment: {
        findUnique: async () => {
          const next = shipmentFindUniqueQueue.shift();
          if (!next) {
            throw new Error('Unexpected tx.orderShipment.findUnique call');
          }
          return next;
        },
        update: async (args) => {
          shipmentUpdateCalls.push(args);
          return args;
        },
        findFirst: async () => null,
        delete: async () => {
          hardDeleteCalled = true;
        },
      },
      shipmentLog: {
        create: async () => ({ id: 'slog-1' }),
      },
      order: {
        update: async (args) => {
          orderUpdateCalls.push(args);
          return args;
        },
      },
      orderLog: {
        create: async () => ({ id: 'olog-1' }),
      },
    }),
  };

  const adminService = loadAdminService(prisma);
  const req = createReq({
    params: { shipmentId: 'ship-1' },
    body: { reason: 'wrong shipment' },
  });
  const res = createRes();

  await adminService.deleteShipmentById(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.message, 'Shipment cancelled successfully');
  assert.equal(hardDeleteCalled, false);
  assert.equal(shipmentUpdateCalls.length, 1);
  assert.ok(shipmentUpdateCalls[0].data.deletedAt instanceof Date);
  assert.equal(orderUpdateCalls.length, 1);
  assert.equal(orderUpdateCalls[0].data.status, 'PENDING');
});

test('adjustVariantInventory locks row and tolerates create-race (P2002)', async () => {
  const rawQueryCalls = [];
  const inventoryUpdateCalls = [];

  const variantReadQueue = [
    {
      id: 'variant-1',
      sku: 'SKU-1',
      size: '9',
      color: 'Black',
      isAvailable: true,
      product: {
        id: 'product-1',
        name: 'Runner',
        brand: 'Aura',
        category: 'RUNNING',
        gender: 'MEN',
      },
    },
    {
      id: 'variant-1',
      sku: 'SKU-1',
      size: '9',
      color: 'Black',
      isAvailable: true,
      product: {
        id: 'product-1',
        name: 'Runner',
        brand: 'Aura',
        category: 'RUNNING',
        gender: 'MEN',
      },
      inventory: {
        id: 'inv-1',
        quantity: 7,
        reserved: 1,
        updatedAt: NOW,
      },
    },
  ];

  const prisma = {
    $transaction: async (callback) => callback({
      productVariant: {
        findUnique: async () => {
          const next = variantReadQueue.shift();
          if (!next) {
            throw new Error('Unexpected tx.productVariant.findUnique call');
          }
          return next;
        },
      },
      inventory: {
        findUnique: async () => null,
        create: async () => {
          const raceError = new Error('duplicate');
          raceError.code = 'P2002';
          throw raceError;
        },
        update: async (args) => {
          inventoryUpdateCalls.push(args);
          return args;
        },
      },
      $queryRaw: async (sql) => {
        rawQueryCalls.push(sql);
        return [{ id: 'inv-1', quantity: 10, reserved: 1 }];
      },
      inventoryLog: {
        create: async () => ({ id: 'ilog-1' }),
      },
    }),
  };

  const adminService = loadAdminService(prisma);
  const req = createReq({
    params: { variantId: 'variant-1' },
    body: {
      operation: 'REDUCE',
      quantity: 3,
    },
  });
  const res = createRes();

  await adminService.adjustVariantInventory(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(rawQueryCalls.length, 1);
  assert.equal(inventoryUpdateCalls.length, 1);
  assert.equal(inventoryUpdateCalls[0].where.id, 'inv-1');
  assert.equal(inventoryUpdateCalls[0].data.quantity, 7);
  assert.equal(res.payload.inventory.inventory.quantity, 7);
});

test('updateVariantInventory enforces reserved guard using locked row data', async () => {
  let inventoryUpdateTouched = false;
  const prisma = {
    $transaction: async (callback) => callback({
      productVariant: {
        findUnique: async () => ({ id: 'variant-1' }),
      },
      inventory: {
        findUnique: async () => ({ id: 'inv-1' }),
        create: async () => ({ id: 'inv-1' }),
        update: async () => {
          inventoryUpdateTouched = true;
          return {};
        },
      },
      $queryRaw: async () => [{ id: 'inv-1', quantity: 10, reserved: 4 }],
      inventoryLog: {
        create: async () => ({ id: 'ilog-1' }),
      },
    }),
  };

  const adminService = loadAdminService(prisma);
  const req = createReq({
    params: { variantId: 'variant-1' },
    body: {
      quantity: 2,
    },
  });

  await expectServiceError(
    async () => adminService.updateVariantInventory(req, createRes()),
    400,
    /quantity must be >= reserved stock/
  );

  assert.equal(inventoryUpdateTouched, false);
});
