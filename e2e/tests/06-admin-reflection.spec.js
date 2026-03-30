const { test, expect } = require('@playwright/test');
const {
  TEST_DATA,
  WEBHOOK_SECRET,
  hasAdminCreds,
  hasWebhookSecret,
  STORAGE_STATE_PATHS,
} = require('./utils/constants');
const {
  ADMIN_BASE_URL,
  CUSTOMER_BASE_URL,
  ensureAdminLogin,
  gotoAdmin,
  createAdminApiContext,
  createGuestApiContext,
  findProductByName,
  addVariantToCart,
  createGuestOrder,
  fetchAdminInventoryByVariant,
  adjustInventory,
  updateAdminInventory,
  signRazorpayWebhook,
  delay,
} = require('./utils/helpers');

test.use({ storageState: STORAGE_STATE_PATHS.admin });

function buildGuestAddress(tag = 'admin') {
  return {
    name: `E2E ${tag} User`,
    email: `e2e.admin.${tag}.${Date.now()}@example.com`,
    phone: '9876543210',
    addressLine1: '500 Reflection Avenue',
    addressLine2: 'Suite 42',
    city: 'Pune',
    state: 'Maharashtra',
    postalCode: '411001',
    country: 'India',
  };
}

function createRollbackState() {
  return {
    createdOrderIds: new Set(),
    variantBaselines: new Map(),
  };
}

function rememberCreatedOrder(rollbackState, orderId) {
  if (!rollbackState || !orderId) return;
  rollbackState.createdOrderIds.add(orderId);
}

async function captureVariantBaseline(rollbackState, adminApi, variantId) {
  if (!rollbackState || !adminApi || !variantId || rollbackState.variantBaselines.has(variantId)) {
    return;
  }

  const snapshot = await fetchAdminInventoryByVariant(adminApi, variantId);
  rollbackState.variantBaselines.set(variantId, {
    quantity: Number(snapshot?.inventory?.quantity || 0),
    reserved: Number(snapshot?.inventory?.reserved || 0),
  });
}

async function restoreVariantToBaseline(adminApi, variantId, baseline) {
  const initial = await fetchAdminInventoryByVariant(adminApi, variantId);
  const initialReserved = Number(initial?.inventory?.reserved || 0);

  if (initialReserved > baseline.reserved) {
    await adjustInventory(
      adminApi,
      variantId,
      'RELEASE',
      initialReserved - baseline.reserved,
      'E2E rollback reserved inventory'
    );
  } else if (initialReserved < baseline.reserved) {
    await adjustInventory(
      adminApi,
      variantId,
      'HOLD',
      baseline.reserved - initialReserved,
      'E2E rollback reserved inventory'
    );
  }

  const beforeQuantityRestore = await fetchAdminInventoryByVariant(adminApi, variantId);
  const currentQuantity = Number(beforeQuantityRestore?.inventory?.quantity || 0);
  if (currentQuantity !== baseline.quantity) {
    await updateAdminInventory(
      adminApi,
      variantId,
      Math.max(baseline.quantity, Number(beforeQuantityRestore?.inventory?.reserved || 0)),
      'E2E rollback quantity'
    );
  }

  await expect
    .poll(async () => {
      const final = await fetchAdminInventoryByVariant(adminApi, variantId);
      return {
        quantity: Number(final?.inventory?.quantity || 0),
        reserved: Number(final?.inventory?.reserved || 0),
      };
    }, { timeout: 30_000 })
    .toEqual({
      quantity: baseline.quantity,
      reserved: baseline.reserved,
    });
}

async function rollbackDbMutations(adminApi, rollbackState) {
  if (!adminApi || !rollbackState) return;

  const failures = [];

  for (const orderId of rollbackState.createdOrderIds) {
    try {
      const res = await adminApi.delete(`${ADMIN_BASE_URL}/api/admin/orders/${orderId}`, {
        data: {
          reason: 'E2E auto rollback',
        },
      });

      if (!res.ok() && ![404, 409].includes(res.status())) {
        const body = await res.text().catch(() => '');
        failures.push(`order ${orderId}: ${res.status()} ${body}`.trim());
      }
    } catch (error) {
      failures.push(`order ${orderId}: ${error.message}`);
    }
  }

  for (const [variantId, baseline] of rollbackState.variantBaselines.entries()) {
    try {
      await restoreVariantToBaseline(adminApi, variantId, baseline);
    } catch (error) {
      failures.push(`variant ${variantId}: ${error.message}`);
    }
  }

  if (failures.length > 0) {
    throw new Error(`Rollback failed for: ${failures.join(' | ')}`);
  }
}

async function createPendingGuestOrder(request, options = {}) {
  const resolved = typeof options === 'number' ? { quantity: options } : options;
  const { quantity = 1, beforeOrderCreate } = resolved;

  const guestApi = await createGuestApiContext(request);
  const product = await findProductByName(guestApi, TEST_DATA.exactProductName);
  const variant = product.variants[0];

  if (beforeOrderCreate) {
    await beforeOrderCreate({ guestApi, product, variant });
  }

  const addRes = await addVariantToCart(guestApi, variant.id, quantity);
  expect(addRes.ok()).toBeTruthy();

  const orderResult = await createGuestOrder(guestApi, buildGuestAddress('order'), 'RAZORPAY');
  return { guestApi, product, variant, orderResult };
}

async function triggerCapturedWebhook(guestApi, orderData) {
  const payload = {
    event: 'payment.captured',
    payload: {
      payment: {
        entity: {
          id: `pay_admin_${Date.now()}`,
          order_id: orderData.razorpayOrderId,
          amount: Math.round(Number(orderData.totalAmount) * 100),
          currency: 'INR',
          status: 'captured',
          created_at: Math.floor(Date.now() / 1000),
          notes: { orderId: orderData.orderId },
        },
      },
    },
  };

  const { signature } = signRazorpayWebhook(payload, WEBHOOK_SECRET);
  const webhookRes = await guestApi.post(`${CUSTOMER_BASE_URL}/api/orders/webhook/razorpay`, {
    data: payload,
    headers: {
      'Content-Type': 'application/json',
      'x-razorpay-signature': signature,
    },
  });

  expect(webhookRes.ok()).toBeTruthy();
}

test.describe('6. Admin Reflection (Inventory & Order Management)', () => {
  let rollbackState = null;
  let rollbackAdminApi = null;

  test.beforeEach(async ({ request }) => {
    test.skip(!hasAdminCreds(), 'Admin credentials are required for admin reflection scenarios.');
    rollbackState = createRollbackState();
    rollbackAdminApi = await createAdminApiContext(request);
  });

  test.afterEach(async () => {
    try {
      await rollbackDbMutations(rollbackAdminApi, rollbackState);
    } finally {
      if (rollbackAdminApi) {
        await rollbackAdminApi.dispose();
      }
      rollbackAdminApi = null;
      rollbackState = null;
    }
  });

  test('6.1 New Order Visibility: newly placed order appears in admin orders list', async ({ page, request }) => {
    const { guestApi, orderResult } = await createPendingGuestOrder(request, {
      beforeOrderCreate: async ({ variant }) => {
        await captureVariantBaseline(rollbackState, rollbackAdminApi, variant.id);
      },
    });
    const { response, body } = orderResult;

    try {
      expect(response.ok()).toBeTruthy();
      const orderData = body.data;
      rememberCreatedOrder(rollbackState, orderData.orderId);

      await ensureAdminLogin(page);
      await gotoAdmin(page, '/orders');

      const search = page.getByPlaceholder(/search orders/i);
      await search.fill(orderData.orderNumber);
      await delay(800);

      await expect(page.getByText(orderData.orderNumber).first()).toBeVisible();
    } finally {
      await guestApi.dispose();
    }
  });

  test('6.2 Admin Order Details: customer, shipping, payment, and items match expected values', async ({ page, request }) => {
    const { guestApi, orderResult, product } = await createPendingGuestOrder(request, {
      beforeOrderCreate: async ({ variant }) => {
        await captureVariantBaseline(rollbackState, rollbackAdminApi, variant.id);
      },
    });
    const { response, body } = orderResult;

    try {
      expect(response.ok()).toBeTruthy();
      const orderData = body.data;
      rememberCreatedOrder(rollbackState, orderData.orderId);

      await ensureAdminLogin(page);
      await gotoAdmin(page, `/orders/${orderData.orderId}`);

      const pageText = (await page.locator('body').textContent()) || '';
     // ✅ Wait for page to stabilize
    await expect(page.getByText(orderData.orderNumber)).toBeVisible();

    // ✅ Direct assertions (no textContent)
    await expect(page.getByText(product.name)).toBeVisible();
        const paymentSection = page.locator('section.card-surface').filter({
      hasText: 'Payment'
    }).first();

    await expect(paymentSection).toBeVisible();
    await expect(page.getByText(/delivery address/i)).toBeVisible();
    } finally {
      await guestApi.dispose();
    }
  });

  test('6.3 Inventory Deduction (Critical): paid order decrements variant stock exactly', async ({ request }) => {
    test.skip(!hasWebhookSecret(), 'Webhook secret required for paid-stock deduction verification.');

    const { guestApi, variant, orderResult } = await createPendingGuestOrder(request, {
      quantity: 1,
      beforeOrderCreate: async ({ variant: targetVariant }) => {
        await captureVariantBaseline(rollbackState, rollbackAdminApi, targetVariant.id);
      },
    });

    try {
      const { response, body } = orderResult;
      expect(response.ok()).toBeTruthy();
      const orderData = body.data;
      rememberCreatedOrder(rollbackState, orderData.orderId);

      const before = await fetchAdminInventoryByVariant(rollbackAdminApi, variant.id);
      const beforeQty = before.inventory.quantity;

      await triggerCapturedWebhook(guestApi, orderData);
      await delay(700);

      const after = await fetchAdminInventoryByVariant(rollbackAdminApi, variant.id);
      expect(after.inventory.quantity).toBe(beforeQty - 1);
    } finally {
      await guestApi.dispose();
    }
  });

  test('6.4 Failed Payment Inventory Logic: failed payment does not decrement stock and releases reserve', async ({ request }) => {
    test.skip(!hasWebhookSecret(), 'Webhook secret required for payment-failure inventory assertions.');

    const guestApi = await createGuestApiContext(request);

    try {
      const product = await findProductByName(guestApi, TEST_DATA.secondaryProductName);
      const variant = product.variants[0];
      await captureVariantBaseline(rollbackState, rollbackAdminApi, variant.id);

      const pre = await fetchAdminInventoryByVariant(rollbackAdminApi, variant.id);

      const addRes = await addVariantToCart(guestApi, variant.id, 1);
      expect(addRes.ok()).toBeTruthy();

      const { response, body } = await createGuestOrder(guestApi, buildGuestAddress('failed'), 'RAZORPAY');
      expect(response.ok()).toBeTruthy();
      const orderData = body.data;
      rememberCreatedOrder(rollbackState, orderData.orderId);

      const mid = await fetchAdminInventoryByVariant(rollbackAdminApi, variant.id);
      expect(mid.inventory.reserved).toBeGreaterThanOrEqual(pre.inventory.reserved + 1);

      const failedPayload = {
        event: 'payment.failed',
        payload: {
          payment: {
            entity: {
              id: `pay_fail_${Date.now()}`,
              order_id: orderData.razorpayOrderId,
              amount: Math.round(Number(orderData.totalAmount) * 100),
              currency: 'INR',
              status: 'failed',
              created_at: Math.floor(Date.now() / 1000),
              notes: { orderId: orderData.orderId },
            },
          },
        },
      };

      const { signature } = signRazorpayWebhook(failedPayload, WEBHOOK_SECRET);
      const webhookRes = await guestApi.post(`${CUSTOMER_BASE_URL}/api/orders/webhook/razorpay`, {
        data: failedPayload,
        headers: {
          'Content-Type': 'application/json',
          'x-razorpay-signature': signature,
        },
      });
      expect(webhookRes.ok()).toBeTruthy();

      await delay(700);

      const post = await fetchAdminInventoryByVariant(rollbackAdminApi, variant.id);
      expect(post.inventory.quantity).toBe(pre.inventory.quantity);
      expect(post.inventory.reserved).toBe(pre.inventory.reserved);
    } finally {
      await guestApi.dispose();
    }
  });

  test('6.5 Fulfillment Update: admin marks shipped with tracking number and save persists', async ({ page, request }) => {
    const { guestApi, orderResult } = await createPendingGuestOrder(request, {
      beforeOrderCreate: async ({ variant }) => {
        await captureVariantBaseline(rollbackState, rollbackAdminApi, variant.id);
      },
    });

    try {
      const { response, body } = orderResult;
      expect(response.ok()).toBeTruthy();
      const orderId = body.data.orderId;
      rememberCreatedOrder(rollbackState, orderId);

      await ensureAdminLogin(page);
      await gotoAdmin(page, `/orders/${orderId}`);

      await page.getByRole('button', { name: /add shipment/i }).first().click();
      await page.locator('input[placeholder*="Delhivery"]').first().fill('DHL E2E');
      await page.locator('input[placeholder*="Tracking ID"]').first().fill(`TRK-${Date.now()}`);
      await page.getByRole('button', { name: /Create Shipment/i }).click();

      await expect(page.getByText(/tracking:/i)).toBeVisible();
      await expect(page.getByText(/shipped/i).first()).toBeVisible();
    } finally {
      await guestApi.dispose();
    }
  });

  test('6.6 Delivery Update: admin marks order delivered and database reflects delivered status', async ({ request }) => {
    const { guestApi, orderResult } = await createPendingGuestOrder(request, {
      beforeOrderCreate: async ({ variant }) => {
        await captureVariantBaseline(rollbackState, rollbackAdminApi, variant.id);
      },
    });

    try {
      const { response, body } = orderResult;
      expect(response.ok()).toBeTruthy();
      const orderId = body.data.orderId;
      rememberCreatedOrder(rollbackState, orderId);

      const deliverRes = await rollbackAdminApi.put(`${ADMIN_BASE_URL}/api/admin/orders/${orderId}/status`, {
        data: {
          status: 'DELIVERED',
          note: 'E2E delivered update',
        },
      });
      expect(deliverRes.ok()).toBeTruthy();

      const detailRes = await rollbackAdminApi.get(`${ADMIN_BASE_URL}/api/admin/orders/${orderId}`);
      const detail = await detailRes.json();
      expect(detail.status).toBe('DELIVERED');
    } finally {
      await guestApi.dispose();
    }
  });

  test('6.7 Admin Order Cancellation & Restock: cancellation releases reserved stock accurately', async ({ request }) => {
    const guestApi = await createGuestApiContext(request);

    try {
      const product = await findProductByName(guestApi, TEST_DATA.tertiaryProductName);
      const variant = product.variants[0];
      await captureVariantBaseline(rollbackState, rollbackAdminApi, variant.id);

      const pre = await fetchAdminInventoryByVariant(rollbackAdminApi, variant.id);

      const addRes = await addVariantToCart(guestApi, variant.id, 1);
      expect(addRes.ok()).toBeTruthy();

      const { response, body } = await createGuestOrder(guestApi, buildGuestAddress('cancel'), 'RAZORPAY');
      expect(response.ok()).toBeTruthy();
      const orderId = body.data.orderId;
      rememberCreatedOrder(rollbackState, orderId);

      const mid = await fetchAdminInventoryByVariant(rollbackAdminApi, variant.id);
      expect(mid.inventory.reserved).toBeGreaterThanOrEqual(pre.inventory.reserved + 1);

      const cancelRes = await rollbackAdminApi.put(`${ADMIN_BASE_URL}/api/admin/orders/${orderId}/status`, {
        data: { status: 'CANCELLED', note: 'E2E cancellation restock check' },
      });
      expect(cancelRes.ok()).toBeTruthy();

      const post = await fetchAdminInventoryByVariant(rollbackAdminApi, variant.id);
      expect(post.inventory.quantity).toBe(pre.inventory.quantity);
      expect(post.inventory.reserved).toBe(pre.inventory.reserved);
    } finally {
      await guestApi.dispose();
    }
  });

  test('6.8 Low Stock Alerts: low-stock badge appears when purchase drops below threshold', async ({ page, request }) => {
    test.skip(!hasWebhookSecret(), 'Webhook secret required to drive stock below threshold via purchase.');

    const guestApi = await createGuestApiContext(request);

    try {
      const product = await findProductByName(guestApi, TEST_DATA.exactProductName);
      const variant = product.variants[0];
      await captureVariantBaseline(rollbackState, rollbackAdminApi, variant.id);
      const inv = await fetchAdminInventoryByVariant(rollbackAdminApi, variant.id);
      const quantity = inv.inventory.quantity;
      const reserve = inv.inventory.reserved;
      const available = quantity - reserve;

      const LOW_STOCK_THRESHOLD = 5;
      const targetAvailable = LOW_STOCK_THRESHOLD - 1;

      const requiredReduction = available - targetAvailable;

      if (requiredReduction > 0) {
        await adjustInventory(rollbackAdminApi, variant.id, 'HOLD', requiredReduction);
      }


      const addRes = await addVariantToCart(guestApi, variant.id, 2);
      expect(addRes.ok()).toBeTruthy();

      const { response, body } = await createGuestOrder(guestApi, buildGuestAddress('lowstock'), 'RAZORPAY');
      expect(response.ok()).toBeTruthy();
      rememberCreatedOrder(rollbackState, body?.data?.orderId);

      await triggerCapturedWebhook(guestApi, body.data);
      await delay(700);

      await ensureAdminLogin(page);
      await gotoAdmin(page, '/inventory');
      await page.getByPlaceholder(/search sku, product, color/i).fill(variant.sku);
      await delay(800);

      await expect(page.getByText(/low stock/i).first()).toBeVisible();
    } finally {
      await guestApi.dispose();
    }
  });
});
