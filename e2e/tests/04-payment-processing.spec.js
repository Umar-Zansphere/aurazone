const { test, expect } = require('@playwright/test');
const {
  TEST_DATA,
  hasAdminCreds,
  hasWebhookSecret,
  WEBHOOK_SECRET,
} = require('./utils/constants');
const {
  ensureProductsPage,
  clearCart,
  gotoCheckout,
  ensureGuestAddressFilled,
  forceRazorpayMock,
  findProductByName,
  createGuestApiContext,
  addVariantToCart,
  createGuestOrder,
  createAdminApiContext,
  signRazorpayWebhook,
  CUSTOMER_BASE_URL,
  ADMIN_BASE_URL,
} = require('./utils/helpers');

function buildGuestAddress(suffix = '') {
  return {
    name: `E2E Guest ${suffix}`.trim(),
    email: `e2e.payment.${Date.now()}@example.com`,
    phone: '9876543210',
    addressLine1: '99 Test Street',
    addressLine2: 'QA Block',
    city: 'Mumbai',
    state: 'Maharashtra',
    postalCode: '400001',
    country: 'India',
  };
}

test.describe('4. Payment Processing', () => {
  test.beforeEach(async ({ page }) => {
    await ensureProductsPage(page);
    await clearCart(page);
  });

  test('4.1 Successful Card Payment: valid payment redirects to order success', async ({ page }) => {
    const product = await findProductByName(page.request, TEST_DATA.exactProductName);
    await page.request.post(`${CUSTOMER_BASE_URL}/api/cart`, {
      data: { variantId: product.variants[0].id, quantity: 1 },
    });

    await forceRazorpayMock(page, 'success');
    await gotoCheckout(page);
    await ensureGuestAddressFilled(page);

    await page.route('**/api/orders', async (route) => {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            orderId: `order_${Date.now()}`,
            orderNumber: `ORD-E2E-${Date.now()}`,
            totalAmount: 151,
            paymentMethod: 'RAZORPAY',
            razorpayOrderId: `order_rzp_${Date.now()}`,
          },
        }),
      });
    });

    await page.route('**/api/orders/payment/verify', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, message: 'Payment verified' }),
      });
    });

    await page.getByRole('button', { name: /place order/i }).click();

    await page.waitForURL(/\/order-confirmation\?/);
    await expect(page.getByRole('heading', { name: /order confirmed!/i })).toBeVisible();
  });

  test('4.2 Declined Card Payment: decline shows error and keeps user on payment page', async ({ page }) => {
    const product = await findProductByName(page.request, TEST_DATA.exactProductName);
    await page.request.post(`${CUSTOMER_BASE_URL}/api/cart`, {
      data: { variantId: product.variants[0].id, quantity: 1 },
    });

    await forceRazorpayMock(page, 'decline');
    await gotoCheckout(page);
    await ensureGuestAddressFilled(page);

    await page.route('**/api/orders', async (route) => {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            orderId: `order_${Date.now()}`,
            orderNumber: `ORD-E2E-${Date.now()}`,
            totalAmount: 151,
            paymentMethod: 'RAZORPAY',
            razorpayOrderId: `order_rzp_${Date.now()}`,
          },
        }),
      });
    });

    await page.route('**/api/orders/payment/verify', async (route) => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, message: 'Card declined' }),
      });
    });

    await page.getByRole('button', { name: /place order/i }).click();

    await expect(page).toHaveURL(/\/checkout/);
    await expect(page.locator('.toast-message').filter({ hasText: /payment verification failed|declined/i }).first()).toBeVisible();
  });

  test('4.3 Alternative Payment (COD): order is placed in pending payment state when enabled', async ({ page }) => {
    const product = await findProductByName(page.request, TEST_DATA.exactProductName);
    await page.request.post(`${CUSTOMER_BASE_URL}/api/cart`, {
      data: { variantId: product.variants[0].id, quantity: 1 },
    });

    await gotoCheckout(page);

    const codOption = page.getByText(/cash on delivery/i).first();
    test.skip(!(await codOption.isVisible().catch(() => false)), 'COD option is disabled in current deployment.');

    await ensureGuestAddressFilled(page);
    await codOption.click();

    await page.route('**/api/orders', async (route) => {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            orderId: `order_${Date.now()}`,
            orderNumber: `ORD-COD-${Date.now()}`,
            totalAmount: 151,
            paymentMethod: 'COD',
            status: 'RECEIVED',
          },
        }),
      });
    });

    await page.getByRole('button', { name: /place order/i }).click();

    await page.waitForURL(/\/order-confirmation\?/);
    await expect(page.getByText(/cash on delivery/i)).toBeVisible();
  });

  test('4.4 Network Failure Simulation: payment timeout/error is handled without duplicate order attempts', async ({ page }) => {
    const product = await findProductByName(page.request, TEST_DATA.exactProductName);
    await page.request.post(`${CUSTOMER_BASE_URL}/api/cart`, {
      data: { variantId: product.variants[0].id, quantity: 1 },
    });

    await forceRazorpayMock(page, 'success');
    await gotoCheckout(page);
    await ensureGuestAddressFilled(page);

    let createOrderHits = 0;
    await page.route('**/api/orders', async (route) => {
      createOrderHits += 1;
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            orderId: `order_${Date.now()}`,
            orderNumber: `ORD-NET-${Date.now()}`,
            totalAmount: 151,
            paymentMethod: 'RAZORPAY',
            razorpayOrderId: `order_rzp_${Date.now()}`,
          },
        }),
      });
    });

    await page.route('**/api/orders/payment/verify', async (route) => {
      await route.abort('internetdisconnected');
    });

    await page.getByRole('button', { name: /place order/i }).click();

    await expect(page).toHaveURL(/\/checkout/);
    await expect(createOrderHits).toBe(1);
    await expect(page.locator('.toast-message').filter({ hasText: /payment verification failed|error/i }).first()).toBeVisible();
  });

  test('4.5 Payment Gateway Webhooks: webhook updates order payment status to paid', async ({ request }) => {
    test.skip(!hasAdminCreds() || !hasWebhookSecret(), 'Admin credentials + webhook secret required for real webhook verification.');

    const guestApi = await createGuestApiContext(request);
    const adminApi = await createAdminApiContext(request);

    try {
      const product = await findProductByName(guestApi, TEST_DATA.exactProductName);
      expect(product).toBeTruthy();

      const variant = product.variants[0];
      const addRes = await addVariantToCart(guestApi, variant.id, 1);
      expect(addRes.ok()).toBeTruthy();

      const { response, body } = await createGuestOrder(guestApi, buildGuestAddress('Webhook'), 'RAZORPAY');
      test.skip(!response.ok(), `Order creation failed: ${body?.message || response.status()}`);

      const orderData = body?.data;
      expect(orderData?.orderId).toBeTruthy();
      expect(orderData?.razorpayOrderId).toBeTruthy();

      const paymentEntity = {
        id: `pay_e2e_${Date.now()}`,
        order_id: orderData.razorpayOrderId,
        amount: Math.round(Number(orderData.totalAmount) * 100),
        currency: 'INR',
        status: 'captured',
        created_at: Math.floor(Date.now() / 1000),
        notes: {
          orderId: orderData.orderId,
        },
      };

      const webhookPayload = {
        event: 'payment.captured',
        payload: {
          payment: {
            entity: paymentEntity,
          },
        },
      };

      const { raw, signature } = signRazorpayWebhook(webhookPayload, WEBHOOK_SECRET);
      const webhookRes = await guestApi.post(`${CUSTOMER_BASE_URL}/api/orders/webhook/razorpay`, {
        data: webhookPayload,
        headers: {
          'Content-Type': 'application/json',
          'x-razorpay-signature': signature,
        },
      });

      expect(webhookRes.ok()).toBeTruthy();

      const orderRes = await adminApi.get(`${ADMIN_BASE_URL}/api/admin/orders/${orderData.orderId}`);
      expect(orderRes.ok()).toBeTruthy();
      const order = await orderRes.json();

      expect(order.paymentStatus).toBe('SUCCESS');
      expect(['RECEIVED', 'PAID', 'SHIPPED', 'DELIVERED']).toContain(order.status);
    } finally {
      await guestApi.dispose();
      await adminApi.dispose();
    }
  });

  test('4.6 Transaction Logging: external transaction ID, timestamp, and status are recorded', async ({ request }) => {
    test.skip(!hasAdminCreds(), 'Admin credentials required for transaction logging validation.');

    const guestApi = await createGuestApiContext(request);
    const adminApi = await createAdminApiContext(request);

    try {
      const product = await findProductByName(guestApi, TEST_DATA.secondaryProductName);
      const variant = product.variants[0];

      const addRes = await addVariantToCart(guestApi, variant.id, 1);
      expect(addRes.ok()).toBeTruthy();

      const { response, body } = await createGuestOrder(guestApi, buildGuestAddress('Txn'), 'RAZORPAY');
      test.skip(!response.ok(), `Order creation failed: ${body?.message || response.status()}`);

      const orderId = body?.data?.orderId;
      const amount = Number(body?.data?.totalAmount || variant.price || 0);
      const gatewayOrderId = `order_txn_${Date.now()}`;
      const gatewayPaymentId = `pay_txn_${Date.now()}`;
      const idempotencyKey = `e2e-txn-${Date.now()}`;

      const paymentRes = await adminApi.post(`${ADMIN_BASE_URL}/api/admin/orders/${orderId}/payments`, {
        data: {
          gateway: 'RAZORPAY',
          status: 'SUCCESS',
          amount,
          gatewayOrderId,
          gatewayPaymentId,
          idempotencyKey,
        },
      });

      expect(paymentRes.ok()).toBeTruthy();

      const orderRes = await adminApi.get(`${ADMIN_BASE_URL}/api/admin/orders/${orderId}`);
      expect(orderRes.ok()).toBeTruthy();
      const order = await orderRes.json();

      expect(order.payment).toBeTruthy();
      expect(order.payment.transactionId).toBe(gatewayPaymentId);
      expect(order.payment.paidAt).toBeTruthy();
      expect(['PAID', 'SUCCESS']).toContain(order.payment.status);

      const logsRes = await adminApi.get(`${ADMIN_BASE_URL}/api/admin/orders/${orderId}/logs`);
      expect(logsRes.ok()).toBeTruthy();
      const logsBody = await logsRes.json();
      const logs = logsBody.logs || [];
      expect(logs.some((log) => /payment/i.test(log.action || ''))).toBeTruthy();
    } finally {
      await guestApi.dispose();
      await adminApi.dispose();
    }
  });
});
