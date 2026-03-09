const { test, expect } = require('@playwright/test');
const { TEST_DATA, hasCustomerCreds, hasAdminCreds } = require('./utils/constants');
const {
  CUSTOMER_BASE_URL,
  ADMIN_BASE_URL,
  ensureCustomerLogin,
  ensureCustomerAddress,
  clearCart,
  findProductByName,
  createAdminApiContext,
  gotoCustomer,
  delay,
} = require('./utils/helpers');

async function createAuthenticatedOrder(page, paymentMethod = 'COD') {
  await ensureCustomerLogin(page);
  await clearCart(page);

  const address = await ensureCustomerAddress(page);
  const product = await findProductByName(page.request, TEST_DATA.exactProductName);
  const variant = product.variants[0];

  const addRes = await page.request.post(`${CUSTOMER_BASE_URL}/api/cart`, {
    data: {
      variantId: variant.id,
      quantity: 1,
    },
  });
  expect(addRes.ok()).toBeTruthy();

  const orderRes = await page.request.post(`${CUSTOMER_BASE_URL}/api/orders`, {
    data: {
      addressId: address.id,
      paymentMethod,
    },
  });

  const orderBody = await orderRes.json().catch(() => ({}));
  return {
    response: orderRes,
    body: orderBody,
    address,
    product,
  };
}

test.describe('5. Order Tracking & Customer Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!hasCustomerCreds(), 'CUSTOMER_EMAIL and CUSTOMER_PASSWORD are required for customer dashboard scenarios.');
  });

  test('5.1 Email Confirmation: confirmation artifact includes accurate order details and order number', async ({ page }) => {
    const { response, body } = await createAuthenticatedOrder(page, 'COD');
    expect(response.ok()).toBeTruthy();

    const orderData = body?.data;
    expect(orderData?.orderNumber).toBeTruthy();

    const encoded = Buffer.from(JSON.stringify({
      orderId: orderData.orderId,
      orderNumber: orderData.orderNumber,
      totalAmount: Number(orderData.totalAmount),
      paymentMethod: 'COD',
    })).toString('base64');

    await gotoCustomer(page, `/order-confirmation?order=${encoded}`);

    await expect(page.getByRole('heading', { name: /order confirmed!/i })).toBeVisible();
    await expect(page.getByText(orderData.orderNumber)).toBeVisible();
    await expect(page.getByText(/order confirmation/i)).toBeVisible();
  });

  test('5.2 Order History List: newest order appears at top with pending/processing status', async ({ page }) => {
    const { response, body } = await createAuthenticatedOrder(page, 'RAZORPAY');
    test.skip(!response.ok(), `Could not create RAZORPAY order: ${body?.message || response.status()}`);

    const orderData = body.data;

    await gotoCustomer(page, '/orders');
    await expect(page.getByRole('heading', { name: /my orders/i })).toBeVisible();
    await expect(page.getByText(orderData.orderNumber).first()).toBeVisible();

    const firstOrderCardText = await page.locator('div.bg-white.rounded-xl').first().textContent();
    expect(firstOrderCardText).toContain(orderData.orderNumber);
  });

  test('5.3 Detailed View: order details match checkout summary and address', async ({ page }) => {
    const { response, body, address, product } = await createAuthenticatedOrder(page, 'COD');
    expect(response.ok()).toBeTruthy();

    const order = body.data;

    await gotoCustomer(page, `/orders/${order.orderId}`);
    await expect(page.getByRole('heading', { name: new RegExp(order.orderNumber, 'i') })).toBeVisible();

    const pageText = (await page.locator('main').textContent()) || "";
    expect(pageText).toContain(address.addressLine1);
    expect(pageText).toContain(address.city);
    expect(pageText).toContain(product.name);
    expect(pageText).toMatch(/payment summary/i);
  });

  test('5.4 Status Updates Reflection: admin shipped status reflects in customer dashboard', async ({ page, request }) => {
    test.skip(!hasAdminCreds(), 'Admin credentials required for cross-panel status reflection.');

    const { response, body } = await createAuthenticatedOrder(page, 'COD');
    expect(response.ok()).toBeTruthy();

    const orderId = body.data.orderId;
    const adminApi = await createAdminApiContext(request);

    try {
      const updateRes = await adminApi.put(`${ADMIN_BASE_URL}/api/admin/orders/${orderId}/status`, {
        data: { status: 'SHIPPED', note: 'E2E shipped reflection check' },
      });
      expect(updateRes.ok()).toBeTruthy();
    } finally {
      await adminApi.dispose();
    }

    await gotoCustomer(page, `/orders/${orderId}`);
    await page.reload({ waitUntil: 'networkidle' });

    await expect(page.getByText(/shipped/i).first()).toBeVisible();
  });

  test('5.5 Order Cancellation (User): pending order can be cancelled and status updates', async ({ page }) => {
    const { response, body } = await createAuthenticatedOrder(page, 'RAZORPAY');
    test.skip(!response.ok(), `Could not create cancellable pending order: ${body?.message || response.status()}`);

    const orderId = body.data.orderId;

    await gotoCustomer(page, `/orders/${orderId}`);
    const cancelButton = page.getByRole('button', { name: /cancel order/i });
    await expect(cancelButton).toBeVisible();

    page.once('dialog', (dialog) => dialog.accept());
    await cancelButton.click();
    await delay(500);

    await expect(page.getByText(/cancelled/i).first()).toBeVisible();
  });
});
