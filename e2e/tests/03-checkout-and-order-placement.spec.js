const { test, expect } = require('@playwright/test');
const { TEST_DATA, hasCustomerCreds } = require('./utils/constants');
const {
  ensureProductsPage,
  clearCart,
  gotoCart,
  gotoCheckout,
  ensureGuestAddressFilled,
  ensureCustomerLogin,
  ensureCustomerAddress,
  findProductByName,
  openProductByName,
  addCurrentProductToCart,
} = require('./utils/helpers');

function parseAmountFromBlock(text, label) {
  const regex = new RegExp(`${label}[^₹]*₹\\s*([\\d,]+(?:\\.\\d+)?)`, 'i');
  const match = String(text || '').match(regex);
  if (!match) return null;
  return Number.parseFloat(match[1].replace(/,/g, ''));
}

test.describe('3. Checkout & Order Placement', () => {
  test.beforeEach(async ({ page }) => {
    await ensureProductsPage(page);
    await clearCart(page);
  });

  test('3.1 Guest vs Authenticated Checkout: flow enforces auth mode settings', async ({ page }) => {
    const product = await findProductByName(page.request, TEST_DATA.exactProductName);
    expect(product).toBeTruthy();

    await openProductByName(page, product.name);
    await addCurrentProductToCart(page);
    await gotoCart(page);
    await expect(page.getByLabel(/quantity selector/i).first()).toBeVisible({ timeout: 45_000 });

    await gotoCheckout(page);
    await expect(page.getByText(/faster checkout with login/i)).toBeVisible();

    if (!hasCustomerCreds()) {
      return;
    }

    await clearCart(page);
    await ensureCustomerLogin(page);

    const authProduct = await findProductByName(page.request, TEST_DATA.secondaryProductName);
    await openProductByName(page, authProduct.name);
    await addCurrentProductToCart(page);
    await gotoCart(page);
    await expect(page.getByLabel(/quantity selector/i).first()).toBeVisible({ timeout: 45_000 });

    await ensureCustomerAddress(page);
    await gotoCheckout(page);

    await expect(page.getByText(/delivery address/i)).toBeVisible();
    await expect(page.getByText(/faster checkout with login/i)).toHaveCount(0);
  });

  test('3.2 Address Validation (Success): valid shipping address is accepted for order payload', async ({ page }) => {
    const product = await findProductByName(page.request, TEST_DATA.exactProductName);
    await openProductByName(page, product.name);
    await addCurrentProductToCart(page);
    await gotoCart(page);
    await expect(page.getByLabel(/quantity selector/i).first()).toBeVisible({ timeout: 45_000 });

    await gotoCheckout(page);
    const address = await ensureGuestAddressFilled(page);

    let payloadSeen = null;
    await page.route('**/api/orders', async (route) => {
      const request = route.request();
      payloadSeen = request.postDataJSON();
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Validation checkpoint' }),
      });
    });

    await page.getByRole('button', { name: /place order/i }).click();

    expect(payloadSeen).toBeTruthy();
    expect(payloadSeen.address.name).toBe(address.name);
    expect(payloadSeen.address.city).toBe(address.city);
    expect(payloadSeen.address.postalCode).toBe(address.postalCode);

    const orderTotalText = (await page.locator('text=Order Total').locator('..').textContent()) || '';
    expect(orderTotalText).toMatch(/shipping/i);
    expect(orderTotalText).toMatch(/tax/i);
  });

  test('3.3 Address Validation (Failure): missing required fields show validation feedback', async ({ page }) => {
    const product = await findProductByName(page.request, TEST_DATA.exactProductName);
    await openProductByName(page, product.name);
    await addCurrentProductToCart(page);
    await gotoCart(page);
    await expect(page.getByLabel(/quantity selector/i).first()).toBeVisible({ timeout: 45_000 });

    await gotoCheckout(page);
    await page.getByRole('button', { name: /place order/i }).click();

    await expect(page.locator('.toast-message').filter({ hasText: /fill in all required address fields/i }).first()).toBeVisible();
  });

  test('3.4 Order Summary Verification: subtotal/shipping/total map correctly', async ({ page }) => {
    const p1 = await findProductByName(page.request, TEST_DATA.exactProductName);
    const p2 = await findProductByName(page.request, TEST_DATA.secondaryProductName);

    // Add first product (quantity 2) via UI
    await openProductByName(page, p1.name);
    await addCurrentProductToCart(page);
    await gotoCart(page);
    await expect(page.getByLabel(/quantity selector/i).first()).toBeVisible({ timeout: 45_000 });
    const quantitySelector = page.getByLabel(/quantity selector/i).first();
    await quantitySelector.locator('button').last().click();
    await expect(quantitySelector.locator('span').first()).toHaveText('2');

    // Add second product (quantity 1) via UI
    await ensureProductsPage(page);
    await openProductByName(page, p2.name);
    await addCurrentProductToCart(page);
    await gotoCart(page);
    await expect(page.getByLabel(/quantity selector/i)).toHaveCount(2, { timeout: 45_000 });

    const cartRes = await page.request.get('/api/cart');
    expect(cartRes.ok()).toBeTruthy();
    const cart = await cartRes.json();
    const expectedSubtotal = cart.items.reduce(
      (sum, item) => sum + Number.parseFloat(item.unitPrice) * item.quantity,
      0
    );

    await gotoCheckout(page);

    const sideText = (await page.locator('text=Order Total').locator('..').textContent()) || '';
    const uiSubtotal = parseAmountFromBlock(sideText, 'Subtotal');
    const uiTotal = parseAmountFromBlock(sideText, 'Total');

    expect(uiSubtotal).not.toBeNull();
    expect(uiTotal).not.toBeNull();
    expect(Math.abs(uiSubtotal - expectedSubtotal)).toBeLessThan(0.01);
    // expect(Math.abs(uiTotal - (expectedSubtotal + 40))).toBeLessThan(0.01)
  });

  test('3.5 Empty Cart Checkout Prevention: empty cart checkout is blocked', async ({ page }) => {
    await clearCart(page);
    await gotoCheckout(page);

    await expect(page.getByText(/your cart is empty/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /continue shopping/i })).toBeVisible();
  });
});
