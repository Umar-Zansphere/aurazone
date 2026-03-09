const { test, expect } = require('@playwright/test');
const {
  TEST_DATA,
  WEBHOOK_SECRET,
  hasAdminCreds,
  hasWebhookSecret,
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
  updateAdminInventory,
  signRazorpayWebhook,
  delay,
} = require('./utils/helpers');

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

async function createPendingGuestOrder(request, quantity = 1) {
  const guestApi = await createGuestApiContext(request);
  const product = await findProductByName(guestApi, TEST_DATA.exactProductName);
  const variant = product.variants[0];

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
  test.beforeEach(async () => {
    test.skip(!hasAdminCreds(), 'Admin credentials are required for admin reflection scenarios.');
  });

  test('6.1 New Order Visibility: newly placed order appears in admin orders list', async ({ page, request }) => {
    const { guestApi, orderResult } = await createPendingGuestOrder(request);
    const { response, body } = orderResult;

    try {
      expect(response.ok()).toBeTruthy();
      const orderData = body.data;

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
    const { guestApi, orderResult, product } = await createPendingGuestOrder(request);
    const { response, body } = orderResult;

    try {
      expect(response.ok()).toBeTruthy();
      const orderData = body.data;

      await ensureAdminLogin(page);
      await gotoAdmin(page, `/orders/${orderData.orderId}`);

      const pageText = (await page.locator('main').textContent()) || '';
      expect(pageText).toContain(orderData.orderNumber);
      expect(pageText).toContain(product.name);
      expect(pageText).toMatch(/payment/i);
      expect(pageText).toMatch(/delivery address/i);
    } finally {
      await guestApi.dispose();
    }
  });

  test('6.3 Inventory Deduction (Critical): paid order decrements variant stock exactly', async ({ request }) => {
    test.skip(!hasWebhookSecret(), 'Webhook secret required for paid-stock deduction verification.');

    const adminApi = await createAdminApiContext(request);
    const { guestApi, variant, orderResult } = await createPendingGuestOrder(request, 1);

    try {
      const { response, body } = orderResult;
      expect(response.ok()).toBeTruthy();
      const orderData = body.data;

      const before = await fetchAdminInventoryByVariant(adminApi, variant.id);
      const beforeQty = before.inventory.quantity;

      await triggerCapturedWebhook(guestApi, orderData);
      await delay(700);

      const after = await fetchAdminInventoryByVariant(adminApi, variant.id);
      expect(after.inventory.quantity).toBe(beforeQty - 1);
    } finally {
      await guestApi.dispose();
      await adminApi.dispose();
    }
  });

  test('6.4 Failed Payment Inventory Logic: failed payment does not decrement stock and releases reserve', async ({ request }) => {
    test.skip(!hasWebhookSecret(), 'Webhook secret required for payment-failure inventory assertions.');

    const adminApi = await createAdminApiContext(request);
    const guestApi = await createGuestApiContext(request);

    try {
      const product = await findProductByName(guestApi, TEST_DATA.secondaryProductName);
      const variant = product.variants[0];

      const pre = await fetchAdminInventoryByVariant(adminApi, variant.id);

      const addRes = await addVariantToCart(guestApi, variant.id, 1);
      expect(addRes.ok()).toBeTruthy();

      const { response, body } = await createGuestOrder(guestApi, buildGuestAddress('failed'), 'RAZORPAY');
      expect(response.ok()).toBeTruthy();
      const orderData = body.data;

      const mid = await fetchAdminInventoryByVariant(adminApi, variant.id);
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

      const post = await fetchAdminInventoryByVariant(adminApi, variant.id);
      expect(post.inventory.quantity).toBe(pre.inventory.quantity);
      expect(post.inventory.reserved).toBe(pre.inventory.reserved);
    } finally {
      await guestApi.dispose();
      await adminApi.dispose();
    }
  });

  test('6.5 Fulfillment Update: admin marks shipped with tracking number and save persists', async ({ page, request }) => {
    const { guestApi, orderResult } = await createPendingGuestOrder(request);

    try {
      const { response, body } = orderResult;
      expect(response.ok()).toBeTruthy();
      const orderId = body.data.orderId;

      await ensureAdminLogin(page);
      await gotoAdmin(page, `/orders/${orderId}`);

      await page.getByRole('button', { name: /add shipment/i }).first().click();
      await page.locator('input[placeholder*="Delhivery"]').first().fill('DHL E2E');
      await page.locator('input[placeholder*="Tracking ID"]').first().fill(`TRK-${Date.now()}`);
      await page.getByRole('button', { name: /create shipment & mark shipped/i }).click();

      await expect(page.getByText(/tracking:/i)).toBeVisible();
      await expect(page.getByText(/shipped/i).first()).toBeVisible();
    } finally {
      await guestApi.dispose();
    }
  });

  test('6.6 Delivery Update: admin marks order delivered and database reflects delivered status', async ({ request }) => {
    const adminApi = await createAdminApiContext(request);
    const { guestApi, orderResult } = await createPendingGuestOrder(request);

    try {
      const { response, body } = orderResult;
      expect(response.ok()).toBeTruthy();
      const orderId = body.data.orderId;

      const deliverRes = await adminApi.put(`${ADMIN_BASE_URL}/api/admin/orders/${orderId}/status`, {
        data: {
          status: 'DELIVERED',
          note: 'E2E delivered update',
        },
      });
      expect(deliverRes.ok()).toBeTruthy();

      const detailRes = await adminApi.get(`${ADMIN_BASE_URL}/api/admin/orders/${orderId}`);
      const detail = await detailRes.json();
      expect(detail.status).toBe('DELIVERED');
    } finally {
      await guestApi.dispose();
      await adminApi.dispose();
    }
  });

  test('6.7 Admin Order Cancellation & Restock: cancellation releases reserved stock accurately', async ({ request }) => {
    const adminApi = await createAdminApiContext(request);
    const guestApi = await createGuestApiContext(request);

    try {
      const product = await findProductByName(guestApi, TEST_DATA.tertiaryProductName);
      const variant = product.variants[0];

      const pre = await fetchAdminInventoryByVariant(adminApi, variant.id);

      const addRes = await addVariantToCart(guestApi, variant.id, 1);
      expect(addRes.ok()).toBeTruthy();

      const { response, body } = await createGuestOrder(guestApi, buildGuestAddress('cancel'), 'RAZORPAY');
      expect(response.ok()).toBeTruthy();
      const orderId = body.data.orderId;

      const mid = await fetchAdminInventoryByVariant(adminApi, variant.id);
      expect(mid.inventory.reserved).toBeGreaterThanOrEqual(pre.inventory.reserved + 1);

      const cancelRes = await adminApi.put(`${ADMIN_BASE_URL}/api/admin/orders/${orderId}/status`, {
        data: { status: 'CANCELLED', note: 'E2E cancellation restock check' },
      });
      expect(cancelRes.ok()).toBeTruthy();

      const post = await fetchAdminInventoryByVariant(adminApi, variant.id);
      expect(post.inventory.quantity).toBe(pre.inventory.quantity);
      expect(post.inventory.reserved).toBe(pre.inventory.reserved);
    } finally {
      await guestApi.dispose();
      await adminApi.dispose();
    }
  });

  test('6.8 Low Stock Alerts: low-stock badge appears when purchase drops below threshold', async ({ page, request }) => {
    test.skip(!hasWebhookSecret(), 'Webhook secret required to drive stock below threshold via purchase.');

    const adminApi = await createAdminApiContext(request);
    const guestApi = await createGuestApiContext(request);
    let restoreVariantId = null;
    let restoreQuantity = null;

    try {
      const product = await findProductByName(guestApi, TEST_DATA.exactProductName);
      const variant = product.variants[0];
      const originalQty = variant.inventory?.quantity ?? 20;
      restoreVariantId = variant.id;
      restoreQuantity = originalQty;

      await updateAdminInventory(adminApi, variant.id, 6, 'E2E low stock prep');

      const addRes = await addVariantToCart(guestApi, variant.id, 2);
      expect(addRes.ok()).toBeTruthy();

      const { response, body } = await createGuestOrder(guestApi, buildGuestAddress('lowstock'), 'RAZORPAY');
      expect(response.ok()).toBeTruthy();

      await triggerCapturedWebhook(guestApi, body.data);
      await delay(700);

      await ensureAdminLogin(page);
      await gotoAdmin(page, '/inventory');
      await page.getByPlaceholder(/search sku, product, color/i).fill(variant.sku);
      await delay(800);

      await expect(page.getByText(/low stock/i).first()).toBeVisible();
    } finally {
      if (restoreVariantId && Number.isInteger(restoreQuantity)) {
        await updateAdminInventory(adminApi, restoreVariantId, restoreQuantity, 'E2E restore quantity');
      }
      await guestApi.dispose();
      await adminApi.dispose();
    }
  });
});
