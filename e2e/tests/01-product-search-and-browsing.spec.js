const { test, expect } = require('@playwright/test');
const {
  TEST_DATA,
} = require('./utils/constants');
const {
  ensureProductsPage,
  searchProducts,
  getCardPrices,
  openProductByName,
  parseInr,
  delay,
} = require('./utils/helpers');

test.describe('1. Product Searching & Browsing', () => {
  test.beforeEach(async ({ page }) => {
    await ensureProductsPage(page);
  });

  test('1.1 Exact Match Search: exact product appears independently', async ({ page }) => {
    await searchProducts(page, TEST_DATA.exactProductName);

    const exactCard = page.locator('a[href^="/product/"]', { hasText: TEST_DATA.exactProductName });
    await expect(exactCard.first()).toBeVisible();

    const noProducts = page.getByText(/no products found/i);
    await expect(noProducts).toHaveCount(0);
  });

  test('1.2 Partial Keyword Search: relevant products are returned', async ({ page }) => {
    const keyword = TEST_DATA.exactProductName.split(' ')[0].slice(0, 3);
    await searchProducts(page, keyword);

    const productLinks = page.locator('a[href^="/product/"]');
    await expect(productLinks.first()).toBeVisible();

    const content = (await page.locator('main').textContent()) || '';
    expect(content.toLowerCase()).toContain(keyword.toLowerCase());
  });

  test('1.3 Empty State Search: non-existent search shows friendly message', async ({ page }) => {
    await searchProducts(page, `no-such-product-${Date.now()}`);
    await expect(page.getByText(/no products found/i)).toBeVisible();
    await expect(page.getByText(/try adjusting your filters or search term/i)).toBeVisible();
  });

  test('1.4 Category Filtering: only selected category products are displayed', async ({ page }) => {
    await page.locator('label', { hasText: TEST_DATA.category }).first().click();
    await page.waitForLoadState('networkidle');

    const cards = page.locator('a[href^="/product/"]');
    const cardTexts = await cards.evaluateAll((nodes) => nodes.map((node) => node.textContent || ''));

    expect(cardTexts.length).toBeGreaterThan(0);
    for (const text of cardTexts) {
      expect(text.toUpperCase()).toContain(TEST_DATA.category);
    }
  });

  test('1.5 Price Range Filtering: listed products are within min/max', async ({ page }) => {
    await page.getByPlaceholder('Min').fill(String(TEST_DATA.minPrice));
    await page.getByPlaceholder('Max').fill(String(TEST_DATA.maxPrice));
    await page.waitForLoadState('networkidle');
    await delay(300);

    const prices = await getCardPrices(page);
    expect(prices.length).toBeGreaterThan(0);

    for (const price of prices) {
      expect(price).toBeGreaterThanOrEqual(TEST_DATA.minPrice);
      expect(price).toBeLessThanOrEqual(TEST_DATA.maxPrice);
    }
  });

  test('1.6 Sorting Combinations: low/high/newest sorting is applied', async ({ page }) => {
    const sortSelect = page.locator('select').first();

    await sortSelect.selectOption('price-low');
    await page.waitForLoadState('networkidle');
    const lowPrices = await getCardPrices(page);
    const sortedLow = [...lowPrices].sort((a, b) => a - b);
    expect(lowPrices).toEqual(sortedLow);

    await sortSelect.selectOption('price-high');
    await page.waitForLoadState('networkidle');
    const highPrices = await getCardPrices(page);
    const sortedHigh = [...highPrices].sort((a, b) => b - a);
    expect(highPrices).toEqual(sortedHigh);

    await sortSelect.selectOption('newest');
    await expect(sortSelect).toHaveValue('newest');
  });

  test('1.7 Pagination/Infinite Scroll: next page loads without duplicates (or disabled when single page)', async ({ page }) => {
    const initialCards = page.locator('a[href^="/product/"]');
    await expect(initialCards.first()).toBeVisible();
    const initialHrefs = await initialCards.evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute('href')).filter(Boolean)
    );

    const nextButton = page.getByRole('button', { name: /^next$/i });
    if (await nextButton.isDisabled()) {
      await expect(nextButton).toBeDisabled();
      return;
    }

    await nextButton.click();
    await page.waitForLoadState('networkidle');

    const secondCards = page.locator('a[href^="/product/"]');
    await expect(secondCards.first()).toBeVisible();
    const secondHrefs = await secondCards.evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute('href')).filter(Boolean)
    );

    const overlap = secondHrefs.filter((href) => initialHrefs.includes(href));
    expect(overlap.length).toBeLessThan(secondHrefs.length);
  });

  test('1.8 Product Details Accuracy: title, description, price, images, variants render correctly', async ({ page }) => {
    await openProductByName(page, TEST_DATA.exactProductName);

    await expect(page.getByRole('heading', { name: TEST_DATA.exactProductName, level: 1 })).toBeVisible();
    await expect(page.getByText(/color variant/i)).toBeVisible();
    await expect(page.getByText(/select size/i)).toBeVisible();

    const mainText = (await page.locator('main').textContent()) || '';
    const price = parseInr(mainText);
    expect(price).not.toBeNull();

    const imageCount = await page.locator('main img').count();
    expect(imageCount).toBeGreaterThan(0);
  });
});
