const { test, expect } = require('@playwright/test');
const { CUSTOMER_BASE_URL, TEST_DATA, hasAdminCreds } = require('./utils/constants');
const {
  ensureProductsPage,
  openProductByName,
  addCurrentProductToCart,
  gotoCart,
  clearCart,
  fetchCart,
  parseInr,
  createAdminApiContext,
  findProductByName,
  updateAdminInventory,
} = require('./utils/helpers');

const joinUrl = (base, path = '/') => `${base}${path.startsWith('/') ? path : `/${path}`}`;

async function selectVariant(page, color, size) {
  const colorButton = page.getByRole('button', { name: new RegExp(color, 'i') }).first();
  if (await colorButton.isVisible().catch(() => false)) {
    await colorButton.click();
  }

  const sizeButton = page.getByRole('button', { name: new RegExp(size.replace(/\s+/g, '\\s*'), 'i') }).first();
  if (await sizeButton.isVisible().catch(() => false)) {
    await sizeButton.click();
  }
}

async function getCartBadgeCount(page) {
  const badge = page.locator('[aria-label="Shopping cart"] span').first();
  if ((await badge.count()) === 0) return 0;
  const raw = (await badge.textContent()) || '';
  const digits = raw.replace(/[^\d]/g, '');
  return Number.parseInt(digits || '0', 10) || 0;
}

function getOrderSummaryContainer(page) {
  // In the cart page the H2 lives inside the container that also holds subtotal/total rows.
  return page.getByRole('heading', { name: /order summary/i }).locator('..');
}

async function getUiSubtotal(page) {
  const summary = getOrderSummaryContainer(page);
  const subtotalRow = summary.getByText(/^subtotal$/i).locator('..');
  const valueText = (await subtotalRow.locator('span').nth(1).textContent()) || '';
  return parseInr(valueText);
}

test.describe('2. Cart Management', () => {
  test.beforeEach(async ({ page }) => {
    await ensureProductsPage(page);
    await clearCart(page);
  });

  test('2.1 Add Simple Product: button swaps to quantity selector', async ({ page }) => {
    const before = await getCartBadgeCount(page);

    await openProductByName(page, TEST_DATA.exactProductName);
    await addCurrentProductToCart(page);

    // Verify UI transformation
    await expect(page.getByRole('button', { name: /add to cart/i })).toBeHidden();
    await expect(page.getByLabel(/quantity selector/i).first()).toBeVisible();

    await expect.poll(() => getCartBadgeCount(page)).toBeGreaterThan(before);
  });

  test('2.2 Add Product with Variants: selected variant is added', async ({ page }) => {
    await openProductByName(page, TEST_DATA.exactProductName);
    await selectVariant(page, TEST_DATA.variantColor, TEST_DATA.variantSize);
    await addCurrentProductToCart(page);

    await gotoCart(page);
    await expect(page.getByText(new RegExp(TEST_DATA.variantColor, 'i'))).toBeVisible();
    await expect(page.getByText(new RegExp(TEST_DATA.variantSize.replace(/\s+/g, '\\s*'), 'i'))).toBeVisible();
  });

  test('2.3 Out of Stock Prevention: adding unavailable stock is blocked', async ({ page, request }) => {
    test.skip(!hasAdminCreds(), 'Admin credentials required for stock mutation scenarios.');

    const adminApi = await createAdminApiContext(request);
    const product = await findProductByName(page.request, TEST_DATA.exactProductName);
    expect(product).toBeTruthy();

    const variant = product.variants.find((item) => item.size === TEST_DATA.variantSize) || product.variants[0];
    expect(variant).toBeTruthy();

    const originalQty = variant.inventory?.quantity ?? 0;

    try {
      await updateAdminInventory(adminApi, variant.id, 0, 'E2E out-of-stock validation');

      await openProductByName(page, product.name);
      await selectVariant(page, variant.color, variant.size);
      await addCurrentProductToCart(page);

      await expect(page.locator('.toast-message').filter({ hasText: /insufficient inventory|failed to add/i }).first()).toBeVisible();
    } finally {
      await updateAdminInventory(adminApi, variant.id, originalQty, 'E2E restore stock');
      await adminApi.dispose();
    }
  });

  test('2.4 Exceeding Stock Limit: quantity above inventory is prevented', async ({ page, request }) => {
    test.skip(!hasAdminCreds(), 'Admin credentials required for stock mutation scenarios.');

    const adminApi = await createAdminApiContext(request);
    const product = await findProductByName(page.request, TEST_DATA.exactProductName);
    const variant = product.variants[0];
    const originalQty = variant.inventory?.quantity ?? 0;

    try {
      await updateAdminInventory(adminApi, variant.id, 1, 'E2E limit quantity test');

      const addRes = await page.request.post(joinUrl(CUSTOMER_BASE_URL, '/api/cart'), {
        data: { variantId: variant.id, quantity: 1 },
      });
      expect(addRes.ok()).toBeTruthy();

      const cart = await fetchCart(page);
      const cartItem = cart.items.find((item) => item.variantId === variant.id);
      expect(cartItem).toBeTruthy();

      const updateRes = await page.request.patch(joinUrl(CUSTOMER_BASE_URL, `/api/cart/${cartItem.id}`), {
        data: { quantity: 2 },
      });
      expect(updateRes.ok()).toBeFalsy();

      const body = await updateRes.json();
      expect(body.message.toLowerCase()).toContain('insufficient inventory');
    } finally {
      await clearCart(page);
      await updateAdminInventory(adminApi, variant.id, originalQty, 'E2E restore stock');
      await adminApi.dispose();
    }
  });

  test('2.5 Quantity Increment: subtotal and total update immediately', async ({ page }) => {
    await openProductByName(page, TEST_DATA.exactProductName);
    await addCurrentProductToCart(page);

    await gotoCart(page);

    const beforeSubtotal = await getUiSubtotal(page);
    expect(beforeSubtotal).not.toBeNull();

    const firstQtySelector = page.getByLabel(/quantity selector/i).first();
    await firstQtySelector.getByRole('button').nth(1).click(); // plus

    await expect.poll(() => getUiSubtotal(page)).toBeGreaterThan(beforeSubtotal);
  });

  test('2.6 Quantity Decrement to Zero: item auto-removes', async ({ page }) => {
    await openProductByName(page, TEST_DATA.exactProductName);
    await addCurrentProductToCart(page);

    const qtySelector = page.getByLabel(/quantity selector/i).first();
    await expect(qtySelector).toBeVisible();
    await qtySelector.getByRole('button').first().click(); // decrement (becomes trash at 1)

    await expect(page.getByRole('button', { name: /add to cart/i })).toBeVisible();

    await gotoCart(page);
    await expect(page.getByText(/your cart is empty/i)).toBeVisible();
  });

  test('2.7 Explicit Removal: remove icon deletes item and updates total', async ({ page }) => {
    await openProductByName(page, TEST_DATA.exactProductName);
    await addCurrentProductToCart(page);

    await gotoCart(page);
    const removeButton = page.locator('button[title="Remove from cart"]').first();
    await expect(removeButton).toBeVisible();
    await removeButton.click();

    await expect(page.getByText(/your cart is empty/i)).toBeVisible();
  });

  test('2.8 Complex Cart Calculation: subtotal matches sum of item totals', async ({ page }) => {
    const firstProduct = await findProductByName(page.request, TEST_DATA.exactProductName);
    const secondProduct = await findProductByName(page.request, TEST_DATA.secondaryProductName);

    expect(firstProduct).toBeTruthy();
    expect(secondProduct).toBeTruthy();

    const firstVariant = firstProduct.variants[0];
    const secondVariant = secondProduct.variants[0];

    await page.request.post(joinUrl(CUSTOMER_BASE_URL, '/api/cart'), {
      data: { variantId: firstVariant.id, quantity: 2 },
    });
    await page.request.post(joinUrl(CUSTOMER_BASE_URL, '/api/cart'), {
      data: { variantId: secondVariant.id, quantity: 1 },
    });

    const cart = await fetchCart(page);
    const expectedSubtotal = cart.items.reduce(
      (sum, item) => sum + Number.parseFloat(item.unitPrice) * item.quantity,
      0
    );

    await gotoCart(page);
    const summaryText = (await getOrderSummaryContainer(page).textContent()) || '';
    const uiSubtotal = parseInr(summaryText);

    expect(uiSubtotal).not.toBeNull();
    expect(Math.abs(uiSubtotal - expectedSubtotal)).toBeLessThan(0.01);
  });

  test('2.9 Cart Persistence: cart content survives page refresh', async ({ page }) => {
    await openProductByName(page, TEST_DATA.exactProductName);
    await addCurrentProductToCart(page);

    await gotoCart(page);
    await expect(page.getByText(TEST_DATA.exactProductName)).toBeVisible();

    await page.reload({ waitUntil: 'networkidle' });
    await expect(page.getByText(TEST_DATA.exactProductName)).toBeVisible();
  });
});
