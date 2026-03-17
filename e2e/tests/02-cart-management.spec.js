const { test, expect } = require('@playwright/test');
const { TEST_DATA, hasAdminCreds } = require('./utils/constants');
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
  delay,
} = require('./utils/helpers');

async function selectVariant(page, color, size) {
  const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const colorButton = page.locator(`button:has(img[alt="${color}"])`).first();
  if (await colorButton.isVisible().catch(() => false)) {
    await colorButton.click();
  }

  const sizeButton = page.getByRole('button', {
    name: new RegExp(`^${escapeRegex(size).replace(/\s+/g, '\\s*')}$`, 'i'),
  }).first();
  if (await sizeButton.isVisible().catch(() => false)) {
    await sizeButton.click();
  }
}

function extractSubtotal(text) {
  const match = text.match(/Subtotal\s*₹\s*([\d,]+(?:\.\d+)?)/i);
  if (!match) return null;
  return Number.parseFloat(match[1].replace(/,/g, ''));
}

test.describe('2. Cart Management', () => {
  test.beforeEach(async ({ page }) => {
    await ensureProductsPage(page);
    await clearCart(page);
  });

  test('2.1 Add Simple Product: button swaps to added state', async ({ page }) => {
    const cartBadge = page.locator('[aria-label="Shopping cart"] span').first();
    const beforeCount = await cartBadge.textContent().catch(() => '0');
    const before = Number.parseInt(beforeCount || '0', 10) || 0;

    await openProductByName(page, TEST_DATA.exactProductName);
    await addCurrentProductToCart(page);

    await expect(page.getByRole('button', { name: /^added to cart$/i }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /^add to cart$/i })).toHaveCount(0);

    await expect
      .poll(async () => {
        const afterCount = await cartBadge.textContent().catch(() => '0');
        return Number.parseInt(afterCount || '0', 10) || 0;
      }, { timeout: 45_000 })
      .toBeGreaterThan(before);
  });

  test('2.2 Add Product with Variants: selected variant is added', async ({ page }) => {
    await openProductByName(page, TEST_DATA.exactProductName);
    await selectVariant(page, TEST_DATA.variantColor, TEST_DATA.variantSize);
    await addCurrentProductToCart(page);

    await gotoCart(page);
    const cartText = (await page.locator('main').textContent()) || '';

    expect(cartText).toContain(TEST_DATA.variantColor);
    expect(cartText).toContain(TEST_DATA.variantSize);
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

      const addRes = await page.request.post('https://www.aurazone.shop/api/cart', {
        data: { variantId: variant.id, quantity: 1 },
      });
      expect(addRes.ok()).toBeTruthy();

      const cart = await fetchCart(page);
      const cartItem = cart.items.find((item) => item.variantId === variant.id);
      expect(cartItem).toBeTruthy();

      const updateRes = await page.request.patch(`https://www.aurazone.shop/api/cart/${cartItem.id}`, {
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

    const summary = page.locator('text=Order Summary').locator('..');
    const beforeText = (await summary.textContent()) || '';
    const beforeSubtotal = extractSubtotal(beforeText);

    const quantitySelector = page.getByLabel(/quantity selector/i).first();
    const quantityValue = quantitySelector.locator('span').first();

    await quantitySelector.locator('button').last().click();
    await expect(quantityValue).toHaveText('2');
    
    await delay(500);

    const afterText = (await summary.textContent()) || '';
    const afterSubtotal = extractSubtotal(afterText);

    expect(beforeSubtotal).not.toBeNull();
    expect(afterSubtotal).not.toBeNull();
    expect(afterSubtotal).toBeGreaterThan(beforeSubtotal);
  });

  test('2.6 Quantity Decrement: quantity reduces but not below one', async ({ page }) => {
    await openProductByName(page, TEST_DATA.exactProductName);
    await addCurrentProductToCart(page);

    await gotoCart(page);
    const quantitySelector = page.getByLabel(/quantity selector/i).first();
    const quantityValue = quantitySelector.locator('span').first();

    await quantitySelector.locator('button').last().click();
    await expect(quantityValue).toHaveText('2');

    await quantitySelector.locator('button').first().click();
    await expect(quantityValue).toHaveText('1');
    await expect(quantitySelector.locator('button').first()).toBeDisabled();

    await expect(page.getByText(TEST_DATA.exactProductName)).toBeVisible();
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

    await page.request.post('https://www.aurazone.shop/api/cart', {
      data: { variantId: firstVariant.id, quantity: 2 },
    });
    await page.request.post('https://www.aurazone.shop/api/cart', {
      data: { variantId: secondVariant.id, quantity: 1 },
    });

    const cart = await fetchCart(page);
    const expectedSubtotal = cart.items.reduce(
      (sum, item) => sum + Number.parseFloat(item.unitPrice) * item.quantity,
      0
    );

    await gotoCart(page);
    const summaryText = (await page.locator('text=Order Summary').locator('..').textContent()) || '';
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
