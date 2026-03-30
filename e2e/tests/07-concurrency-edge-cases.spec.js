const { test, expect } = require('@playwright/test');
const { getTestData, hasAdminCreds } = require('./utils/constants');
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
  adjustInventory,
  delay,
} = require('./utils/helpers');

const TEST_DATA = getTestData('concurrency');

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

function createRollbackState() {
  return {
    createdOrderIds: new Set(),
    inventoryBaselines: new Map(),
    variantPayloadBaselines: new Map(),
    productPayloadBaselines: new Map(),
  };
}

function rememberCreatedOrder(rollbackState, orderId) {
  if (!rollbackState || !orderId) return;
  rollbackState.createdOrderIds.add(orderId);
}

async function captureInventoryBaseline(rollbackState, adminApi, variantId) {
  if (!rollbackState || !adminApi || !variantId || rollbackState.inventoryBaselines.has(variantId)) {
    return;
  }

  const snapshot = await fetchAdminInventoryByVariant(adminApi, variantId);
  rollbackState.inventoryBaselines.set(variantId, {
    quantity: Number(snapshot?.inventory?.quantity || 0),
    reserved: Number(snapshot?.inventory?.reserved || 0),
  });
}

function rememberVariantPayloadBaseline(rollbackState, variantId, payload) {
  if (!rollbackState || !variantId || !payload || rollbackState.variantPayloadBaselines.has(variantId)) {
    return;
  }

  rollbackState.variantPayloadBaselines.set(variantId, payload);
}

function rememberProductPayloadBaseline(rollbackState, productId, payload) {
  if (!rollbackState || !productId || !payload || rollbackState.productPayloadBaselines.has(productId)) {
    return;
  }

  rollbackState.productPayloadBaselines.set(productId, payload);
}

async function restoreInventoryToBaseline(adminApi, variantId, baseline) {
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

  const final = await fetchAdminInventoryByVariant(adminApi, variantId);
  expect(Number(final?.inventory?.quantity || 0)).toBe(baseline.quantity);
  expect(Number(final?.inventory?.reserved || 0)).toBe(baseline.reserved);
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

  for (const [variantId, baseline] of rollbackState.inventoryBaselines.entries()) {
    try {
      await restoreInventoryToBaseline(adminApi, variantId, baseline);
    } catch (error) {
      failures.push(`inventory ${variantId}: ${error.message}`);
    }
  }

  for (const [variantId, payload] of rollbackState.variantPayloadBaselines.entries()) {
    try {
      await updateAdminVariant(adminApi, variantId, payload);
    } catch (error) {
      failures.push(`variant ${variantId}: ${error.message}`);
    }
  }

  for (const [productId, payload] of rollbackState.productPayloadBaselines.entries()) {
    try {
      await updateAdminProduct(adminApi, productId, payload);
    } catch (error) {
      failures.push(`product ${productId}: ${error.message}`);
    }
  }

  if (failures.length > 0) {
    throw new Error(`Rollback failed for: ${failures.join(' | ')}`);
  }
}

test.describe('7. Concurrency & Edge Cases', () => {
  let rollbackState = null;
  let rollbackAdminApi = null;

  test.beforeEach(async ({ page, request }) => {
    rollbackState = createRollbackState();
    rollbackAdminApi = hasAdminCreds() ? await createAdminApiContext(request) : null;

    await ensureProductsPage(page);
    await clearCart(page);
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

  test('7.1 Race Condition (Last Item): one checkout succeeds and the other fails out-of-stock', async ({ request }) => {
    test.skip(!hasAdminCreds(), 'Admin credentials required for concurrent stock race test.');

    const guestOne = await createGuestApiContext(request, { fresh: true });
    const guestTwo = await createGuestApiContext(request, { fresh: true });

    try {
      const product = await findProductByName(guestOne, TEST_DATA.exactProductName);
      const variant = product.variants[0];
      await captureInventoryBaseline(rollbackState, rollbackAdminApi, variant.id);

      await adjustInventory(rollbackAdminApi, variant.id, 'SET', 1, 'E2E last-item race setup');

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
        rememberCreatedOrder(rollbackState, success.body.data.orderId);
      }
    } finally {
      await guestOne.dispose();
      await guestTwo.dispose();
    }
  });

  test('7.2 Price Change Mid-Checkout: checkout uses consistent policy after admin price change', async ({ page }) => {
    test.skip(!hasAdminCreds(), 'Admin credentials required for mid-checkout mutation scenarios.');

    const product = await findProductByName(page.request, TEST_DATA.exactProductName);
    const variant = product.variants[0];
    const originalPrice = Number(variant.price);
    rememberVariantPayloadBaseline(rollbackState, variant.id, { price: originalPrice });

    await page.request.post(`${CUSTOMER_BASE_URL}/api/cart`, {
      data: { variantId: variant.id, quantity: 1 },
    });

    const cartRes = await page.request.get(`${CUSTOMER_BASE_URL}/api/cart`);
    const cart = await cartRes.json();
    const cartPriceBefore = Number(cart.items[0].unitPrice);

    await updateAdminVariant(rollbackAdminApi, variant.id, { price: originalPrice + 75 });

    await gotoCheckout(page);
    const checkoutText = (await page.locator('main').textContent()) || '';
    const containsOld = checkoutText.includes(`₹${cartPriceBefore.toFixed(2)}`) || checkoutText.includes(`₹${cartPriceBefore}`);

    expect(containsOld).toBeTruthy();
  });

  test('7.3 Product Disabled Mid-Checkout: disabled product should be flagged unavailable before order placement', async ({ page }) => {
    test.skip(!hasAdminCreds(), 'Admin credentials required for mid-checkout mutation scenarios.');

    const product = await findProductByName(page.request, TEST_DATA.secondaryProductName);
    const variant = product.variants[0];
    rememberProductPayloadBaseline(rollbackState, product.id, { isActive: product.isActive !== false });

    await page.request.post(`${CUSTOMER_BASE_URL}/api/cart`, {
      data: { variantId: variant.id, quantity: 1 },
    });

    await updateAdminProduct(rollbackAdminApi, product.id, { isActive: false });

    const orderRes = await page.request.post(`${CUSTOMER_BASE_URL}/api/orders`, {
      data: {
        address: makeAddress('disabled'),
        paymentMethod: 'RAZORPAY',
      },
    });

    const body = await orderRes.json().catch(() => ({}));
    expect(orderRes.ok()).toBeFalsy();
    expect((body.message || '').toLowerCase()).toMatch(/unavailable|disabled|not found|out of stock/);
  });

  test('7.4 Stock Zeroed Mid-Checkout: checkout fails with out-of-stock validation', async ({ page }) => {
    test.skip(!hasAdminCreds(), 'Admin credentials required for mid-checkout mutation scenarios.');

    const product = await findProductByName(page.request, TEST_DATA.exactProductName);
    const variant = product.variants[0];
    await captureInventoryBaseline(rollbackState, rollbackAdminApi, variant.id);

    await page.request.post(`${CUSTOMER_BASE_URL}/api/cart`, {
      data: { variantId: variant.id, quantity: 1 },
    });

    await adjustInventory(rollbackAdminApi, variant.id, 'SET', 0, 'E2E stock zero mid-checkout');

    const orderRes = await page.request.post(`${CUSTOMER_BASE_URL}/api/orders`, {
      data: {
        address: makeAddress('stockzero'),
        paymentMethod: 'RAZORPAY',
      },
    });

    const body = await orderRes.json().catch(() => ({}));
    expect(orderRes.ok()).toBeFalsy();
    expect((body.message || '').toLowerCase()).toMatch(/insufficient|out of stock|inventory/);
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
    if (rollbackAdminApi) {
      await captureInventoryBaseline(rollbackState, rollbackAdminApi, variant.id);
    }

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
      rememberCreatedOrder(rollbackState, body.data.orderId);
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
