const { test, expect } = require('@playwright/test');
const { TEST_DATA, hasAdminCreds, CUSTOMER_BASE_URL } = require('./utils/constants');
const {
  ensureProductsPage,
  openProductByName,
  addCurrentProductToCart,
  gotoCart,
  clearCart,
  fetchCart,
  createAdminApiContext,
  findProductByName,
  fetchAdminInventoryByVariant,
  updateAdminInventory,
} = require('./utils/helpers');

async function selectVariant(page, color, size) {
  const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const colorButton = page.locator(`button[data-selected]:has(img[alt="${color}"])`).first();
  if (await colorButton.isVisible().catch(() => false)) {
    await colorButton.click();
    await expect(colorButton).toHaveAttribute('data-selected', 'true');
  }

  const sizeButton = page
    .locator('button[data-selected]')
    .filter({ hasText: new RegExp(`^${escapeRegex(size).replace(/\s+/g, '\\s*')}$`, 'i') })
    .first();
  if (await sizeButton.isVisible().catch(() => false)) {
    await sizeButton.click();
    await expect(sizeButton).toHaveAttribute('data-selected', 'true');
  }

  const selectedColor = ((await page.locator('button[data-selected="true"] img[alt]').first().getAttribute('alt').catch(() => '')) || '').trim();
  const selectedSize = ((await page.locator('button[data-selected="true"]').filter({ hasText: /\S/ }).first().textContent().catch(() => '')) || '').trim();
  return { color: selectedColor, size: selectedSize };
}

function parseCurrencyAmount(text) {
  const match = String(text || '').match(/₹\s*([\d,]+(?:\.\d+)?)/i);
  if (!match) return null;
  return Number.parseFloat(match[1].replace(/,/g, ''));
}

async function readUiSubtotal(page) {
  const subtotalValue = await page
    .locator('xpath=//span[normalize-space()="Subtotal"]/following-sibling::span[1]')
    .first()
    .textContent();

  return parseCurrencyAmount(subtotalValue);
}

const trackedInventoryBaselines = new Map();
let sharedAdminApi = null;

async function captureInventoryBaseline(adminApi, variantId) {
  if (trackedInventoryBaselines.has(variantId)) {
    return trackedInventoryBaselines.get(variantId);
  }

  const snapshot = await fetchAdminInventoryByVariant(adminApi, variantId);
  const baseline = {
    quantity: Number(snapshot?.inventory?.quantity || 0),
  };
  trackedInventoryBaselines.set(variantId, baseline);
  return baseline;
}

async function setVariantAvailableUnits(adminApi, variantId, availableUnits, note) {
  await captureInventoryBaseline(adminApi, variantId);
  const latest = await fetchAdminInventoryByVariant(adminApi, variantId);
  const reserved = Number(latest?.inventory?.reserved || 0);
  const safeQuantity = Math.max(reserved + Math.max(0, Number(availableUnits) || 0), 0);

  await updateAdminInventory(adminApi, variantId, safeQuantity, note);

  await expect
    .poll(async () => {
      const current = await fetchAdminInventoryByVariant(adminApi, variantId);
      const quantity = Number(current?.inventory?.quantity || 0);
      const reservedQty = Number(current?.inventory?.reserved || 0);
      return Math.max(0, quantity - reservedQty);
    }, { timeout: 30_000 })
    .toBe(Math.max(0, Number(availableUnits) || 0));
}

async function restoreTrackedInventory(adminApi, variantId, reason = 'E2E rollback') {
  const baseline = trackedInventoryBaselines.get(variantId);
  if (!baseline) return;

  const current = await fetchAdminInventoryByVariant(adminApi, variantId);
  const reserved = Number(current?.inventory?.reserved || 0);
  const restoreQuantity = Math.max(baseline.quantity, reserved);
  await updateAdminInventory(adminApi, variantId, restoreQuantity, reason);
}

async function resolveTargetVariant(page) {
  const product = await findProductByName(page.request, TEST_DATA.exactProductName);
  expect(product).toBeTruthy();

  const variants = Array.isArray(product?.variants) ? product.variants : [];
  const preferredVariant = variants.find((variant) =>
    variant.color === TEST_DATA.variantColor && variant.size === TEST_DATA.variantSize
  );
  const sizeVariant = variants.find((variant) => variant.size === TEST_DATA.variantSize);
  const targetVariant = preferredVariant || sizeVariant || variants[0];

  expect(targetVariant).toBeTruthy();
  return { product, variant: targetVariant };
}

async function setAllProductVariantsAvailableUnits(adminApi, product, availableUnits, notePrefix) {
  const variants = Array.isArray(product?.variants) ? product.variants : [];
  expect(variants.length).toBeGreaterThan(0);

  for (const variant of variants) {
    await setVariantAvailableUnits(
      adminApi,
      variant.id,
      availableUnits,
      `${notePrefix} (${variant.color || 'NA'}-${variant.size || 'NA'})`
    );
  }
}

async function restoreProductVariants(adminApi, product, reason) {
  const variants = Array.isArray(product?.variants) ? product.variants : [];
  for (const variant of variants) {
    await restoreTrackedInventory(adminApi, variant.id, reason);
  }
}

test.describe('2. Cart Management', () => {
  test.beforeAll(async ({ request }) => {
    if (!hasAdminCreds()) return;
    sharedAdminApi = await createAdminApiContext(request);
  });

  test.beforeEach(async ({ page }) => {
    await ensureProductsPage(page);
    await clearCart(page);
  });

  test.afterAll(async () => {
    if (!sharedAdminApi) return;

    for (const variantId of trackedInventoryBaselines.keys()) {
      try {
        await restoreTrackedInventory(sharedAdminApi, variantId, 'E2E suite final rollback');
      } catch (error) {
        console.error(`Failed to rollback inventory for variant ${variantId}:`, error);
      }
    }

    await sharedAdminApi.dispose();
    sharedAdminApi = null;
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
    const selectedVariant = await selectVariant(page, TEST_DATA.variantColor, TEST_DATA.variantSize);
    await addCurrentProductToCart(page);

    await gotoCart(page);
    const cartText = (await page.locator('body').innerText()) || '';

    expect(selectedVariant.color).toBeTruthy();
    expect(selectedVariant.size).toBeTruthy();
    expect(cartText).toContain(selectedVariant.color);
    expect(cartText).toContain(selectedVariant.size);
  });

  test('2.3 Out of Stock Prevention: adding unavailable stock is blocked', async ({ page }) => {
    test.skip(!hasAdminCreds(), 'Admin credentials required for stock mutation scenarios.');

    expect(sharedAdminApi).toBeTruthy();
    const { product } = await resolveTargetVariant(page);

    try {
      await setAllProductVariantsAvailableUnits(sharedAdminApi, product, 0, 'E2E out-of-stock validation');

      await openProductByName(page, product.name);
      await selectVariant(page, TEST_DATA.variantColor, TEST_DATA.variantSize);

      const addButton = page.getByRole('button', { name: /add to cart/i }).first();
      await expect(page.getByText(/out of stock/i).first()).toBeVisible();
      if (await addButton.count()) {
        await expect(addButton).toBeDisabled();
      }
    } finally {
      await restoreProductVariants(sharedAdminApi, product, 'E2E restore stock after out-of-stock test');
    }
  });

  test('2.4 Exceeding Stock Limit: quantity above inventory is prevented', async ({ page }) => {
    test.skip(!hasAdminCreds(), 'Admin credentials required for stock mutation scenarios.');

    expect(sharedAdminApi).toBeTruthy();
    const { variant } = await resolveTargetVariant(page);

    try {
      await setVariantAvailableUnits(sharedAdminApi, variant.id, 1, 'E2E limit quantity test');

      const addRes = await page.request.post(`${CUSTOMER_BASE_URL}/api/cart`, {
        data: { variantId: variant.id, quantity: 1 },
      });
      expect(addRes.ok()).toBeTruthy();

      const cart = await fetchCart(page);
      const cartItem = cart.items.find((item) => item.variantId === variant.id);
      expect(cartItem).toBeTruthy();

      const updateRes = await page.request.patch(`${CUSTOMER_BASE_URL}/api/cart/${cartItem.id}`, {
        data: { quantity: 2 },
      });
      expect(updateRes.ok()).toBeFalsy();

      const body = await updateRes.json();
      expect(String(body.message || '').toLowerCase()).toMatch(/insufficient inventory|out of stock/);
    } finally {
      await clearCart(page);
      await restoreTrackedInventory(sharedAdminApi, variant.id, 'E2E restore stock after quantity-limit test');
    }
  });

  test('2.5 Quantity Increment: subtotal and total update immediately', async ({ page }) => {
    await openProductByName(page, TEST_DATA.exactProductName);
    await addCurrentProductToCart(page);

    await gotoCart(page);

    const beforeSubtotal = await readUiSubtotal(page);

    const quantitySelector = page.getByLabel(/quantity selector/i).first();
    const quantityValue = quantitySelector.locator('span').first();

    await quantitySelector.locator('button').last().click();
    await expect(quantityValue).toHaveText('2');

    const afterSubtotal = await readUiSubtotal(page);

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

    const addFirstRes = await page.request.post(`${CUSTOMER_BASE_URL}/api/cart`, {
      data: { variantId: firstVariant.id, quantity: 2 },
    });
    expect(addFirstRes.ok()).toBeTruthy();

    const addSecondRes = await page.request.post(`${CUSTOMER_BASE_URL}/api/cart`, {
      data: { variantId: secondVariant.id, quantity: 1 },
    });
    expect(addSecondRes.ok()).toBeTruthy();

    const cart = await fetchCart(page);
    expect(Array.isArray(cart.items) ? cart.items.length : 0).toBeGreaterThan(0);
    const expectedSubtotal = cart.items.reduce(
      (sum, item) => sum + Number.parseFloat(item.unitPrice) * item.quantity,
      0
    );

    await gotoCart(page);
    const uiSubtotal = await readUiSubtotal(page);

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
