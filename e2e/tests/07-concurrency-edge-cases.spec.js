const { test, expect } = require('@playwright/test');
const { TEST_DATA, hasAdminCreds } = require('./utils/constants');
const {
  CUSTOMER_BASE_URL,
  ADMIN_BASE_URL,
  ensureProductsPage,
  clearCart,
  gotoCheckout,
  ensureGuestAddressFilled,
  forceRazorpayMock,
  createAdminApiContext,
  createGuestApiContext,
  findProductByName,
  addVariantToCart,
  createGuestOrder,
  updateAdminInventory,
  updateAdminVariant,
  updateAdminProduct,
  fetchAdminInventoryByVariant,
  delay,
} = require('./utils/helpers');

function makeAddress(tag = 'edge') {
  return {
    name: `E2E ${tag}`,
    email: `e2e.edge.${tag}.${Date.now()}@example.com`,
    phone: '9876543210',
    addressLine1: '11 Edge Street',
    addressLine2: 'Unit #1',
    city: 'Chennai',
    state: 'Tamil Nadu',
    postalCode: '600001',
    country: 'India',
  };
}

test.describe('7. Concurrency & Edge Cases', () => {
  test.beforeEach(async ({ page }) => {
    await ensureProductsPage(page);
    await clearCart(page);
  });

  test('7.1 Race Condition (Last Item): one checkout succeeds and the other fails out-of-stock', async ({ request }) => {
    test.skip(!hasAdminCreds(), 'Admin credentials required for concurrent stock race test.');

    const adminApi = await createAdminApiContext(request);
    const guestOne = await createGuestApiContext(request, { fresh: true });
    const guestTwo = await createGuestApiContext(request, { fresh: true });

    try {
      const product = await findProductByName(guestOne, TEST_DATA.exactProductName);
      const variant = product.variants[0];
      const originalQty = variant.inventory?.quantity ?? 20;

      await updateAdminInventory(adminApi, variant.id, 1, 'E2E last-item race setup');

      expect((await addVariantToCart(guestOne, variant.id, 1)).ok()).toBeTruthy();
      expect((await addVariantToCart(guestTwo, variant.id, 1)).ok()).toBeTruthy();

      const [one, two] = await Promise.all([
        createGuestOrder(guestOne, makeAddress('race-1'), 'RAZORPAY'),
        createGuestOrder(guestTwo, makeAddress('race-2'), 'RAZORPAY'),
      ]);

      const outcomes = [one, two];
      const successCount = outcomes.filter((result) => result.response.ok()).length;
      const failureCount = outcomes.length - successCount;

      expect(successCount).toBe(1);
      expect(failureCount).toBe(1);

      const failed = outcomes.find((result) => !result.response.ok());
      expect((failed.body?.message || '').toLowerCase()).toMatch(/insufficient|out of stock|inventory/);

      const success = outcomes.find((result) => result.response.ok());
      if (success?.body?.data?.orderId) {
        await adminApi.put(`${ADMIN_BASE_URL}/api/admin/orders/${success.body.data.orderId}/status`, {
          data: { status: 'CANCELLED', note: 'E2E cleanup after race test' },
        });
      }

      await updateAdminInventory(adminApi, variant.id, originalQty, 'E2E restore stock after race');
    } finally {
      await guestOne.dispose();
      await guestTwo.dispose();
      await adminApi.dispose();
    }
  });

  test('7.2 Price Change Mid-Checkout: checkout uses consistent policy after admin price change', async ({ page, request }) => {
    test.skip(!hasAdminCreds(), 'Admin credentials required for mid-checkout mutation scenarios.');

    const adminApi = await createAdminApiContext(request);
    const product = await findProductByName(page.request, TEST_DATA.exactProductName);
    const variant = product.variants[0];
    const originalPrice = Number(variant.price);

    try {
      await page.request.post(`${CUSTOMER_BASE_URL}/api/cart`, {
        data: { variantId: variant.id, quantity: 1 },
      });

      const cartRes = await page.request.get(`${CUSTOMER_BASE_URL}/api/cart`);
      const cart = await cartRes.json();
      const cartPriceBefore = Number(cart.items[0].unitPrice);

      await updateAdminVariant(adminApi, variant.id, { price: originalPrice + 75 });

      await gotoCheckout(page);
      const checkoutText = (await page.locator('main').textContent()) || '';
      const containsOld = checkoutText.includes(`₹${cartPriceBefore.toFixed(2)}`) || checkoutText.includes(`₹${cartPriceBefore}`);

      expect(containsOld).toBeTruthy();
    } finally {
      await updateAdminVariant(adminApi, variant.id, { price: originalPrice });
      await adminApi.dispose();
    }
  });

  test('7.3 Product Disabled Mid-Checkout: disabled product should be flagged unavailable before order placement', async ({ page, request }) => {
    test.skip(!hasAdminCreds(), 'Admin credentials required for mid-checkout mutation scenarios.');

    const adminApi = await createAdminApiContext(request);
    const product = await findProductByName(page.request, TEST_DATA.secondaryProductName);
    const variant = product.variants[0];

    try {
      await page.request.post(`${CUSTOMER_BASE_URL}/api/cart`, {
        data: { variantId: variant.id, quantity: 1 },
      });

      await updateAdminProduct(adminApi, product.id, { isActive: false });

      const orderRes = await page.request.post(`${CUSTOMER_BASE_URL}/api/orders`, {
        data: {
          address: makeAddress('disabled'),
          paymentMethod: 'RAZORPAY',
        },
      });

      const body = await orderRes.json().catch(() => ({}));
      expect(orderRes.ok()).toBeFalsy();
      expect((body.message || '').toLowerCase()).toMatch(/unavailable|disabled|not found|out of stock/);
    } finally {
      await updateAdminProduct(adminApi, product.id, { isActive: true });
      await adminApi.dispose();
    }
  });

  test('7.4 Stock Zeroed Mid-Checkout: checkout fails with out-of-stock validation', async ({ page, request }) => {
    test.skip(!hasAdminCreds(), 'Admin credentials required for mid-checkout mutation scenarios.');

    const adminApi = await createAdminApiContext(request);
    const product = await findProductByName(page.request, TEST_DATA.exactProductName);
    const variant = product.variants[0];
    const before = await fetchAdminInventoryByVariant(adminApi, variant.id);

    try {
      await page.request.post(`${CUSTOMER_BASE_URL}/api/cart`, {
        data: { variantId: variant.id, quantity: 1 },
      });

      await updateAdminInventory(adminApi, variant.id, 0, 'E2E stock zero mid-checkout');

      const orderRes = await page.request.post(`${CUSTOMER_BASE_URL}/api/orders`, {
        data: {
          address: makeAddress('stockzero'),
          paymentMethod: 'RAZORPAY',
        },
      });

      const body = await orderRes.json().catch(() => ({}));
      expect(orderRes.ok()).toBeFalsy();
      expect((body.message || '').toLowerCase()).toMatch(/insufficient|out of stock|inventory/);
    } finally {
      await updateAdminInventory(adminApi, variant.id, before.inventory.quantity, 'E2E restore stock after zero test');
      await adminApi.dispose();
    }
  });

  test('7.5 Extreme Quantities/Values: huge quantity requests are handled safely', async ({ page }) => {
    const product = await findProductByName(page.request, TEST_DATA.exactProductName);
    const variant = product.variants[0];

    const res = await page.request.post(`${CUSTOMER_BASE_URL}/api/cart`, {
      data: {
        variantId: variant.id,
        quantity: 2147483647,
      },
    });

    const body = await res.json().catch(() => ({}));
    expect(res.ok()).toBeFalsy();
    expect((body.message || '').toLowerCase()).toMatch(/insufficient|quantity|inventory/);
  });

  test('7.6 Punctuation in Address: special chars/emojis/long text are handled gracefully', async ({ page }) => {
    const product = await findProductByName(page.request, TEST_DATA.tertiaryProductName);
    const variant = product.variants[0];

    await page.request.post(`${CUSTOMER_BASE_URL}/api/cart`, {
      data: { variantId: variant.id, quantity: 1 },
    });

    const res = await page.request.post(`${CUSTOMER_BASE_URL}/api/orders`, {
      data: {
        address: {
          name: 'QA 😀 User -- <> "quotes"',
          email: `qa.edge.${Date.now()}@example.com`,
          phone: '9876543210',
          addressLine1: '123 !!! ??? ### $$$ %%% ^^^ &&& *** ((( )))',
          addressLine2: 'Emoji lane 🚚📦🙂 with extra-long string '.repeat(5),
          city: 'München / சென்னை',
          state: 'State-With_Punctuation;:[]{}',
          postalCode: '600001',
          country: 'India',
        },
        paymentMethod: 'COD',
      },
    });

    expect(res.status()).toBeLessThan(500);
    if (res.ok()) {
      const body = await res.json();
      expect(body.success).toBeTruthy();
      expect(body.data.orderId).toBeTruthy();
    }
  });

  test('7.7 Idempotency Execution: rapid double-submit does not create duplicate order calls', async ({ page }) => {
    const product = await findProductByName(page.request, TEST_DATA.exactProductName);
    await page.request.post(`${CUSTOMER_BASE_URL}/api/cart`, {
      data: { variantId: product.variants[0].id, quantity: 1 },
    });

    await forceRazorpayMock(page, 'success');
    await gotoCheckout(page);
    await ensureGuestAddressFilled(page);

    let createOrderCalls = 0;
    await page.route('**/api/orders', async (route) => {
      createOrderCalls += 1;
      await delay(500);
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            orderId: `order_idem_${Date.now()}`,
            orderNumber: `ORD-IDEM-${Date.now()}`,
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
        body: JSON.stringify({ success: true }),
      });
    });

    const placeOrder = page.getByRole('button', { name: /place order/i });
    await Promise.all([
      placeOrder.click(),
      placeOrder.click().catch(() => null),
    ]);

    await page.waitForURL(/\/order-confirmation\?/);
    await page.reload({ waitUntil: 'networkidle' });

    expect(createOrderCalls).toBe(1);
  });
});
