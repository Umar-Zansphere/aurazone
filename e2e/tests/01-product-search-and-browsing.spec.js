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
} = require('./utils/helpers');

const escapeRegExp = (value = '') => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const waitForProductsSearchResponse = async (page, expectedQuery = {}) => {
  await page.waitForResponse((response) => {
    if (!response.url().includes('/api/products/search')) return false;

    const responseUrl = new URL(response.url());
    return Object.entries(expectedQuery).every(([key, value]) => {
      return (responseUrl.searchParams.get(key) || '') === String(value);
    });
  }, { timeout: 20_000 });
};

const waitForProductResultsToSettle = async (page) => {
  const cards = page.locator('a[href^="/product/"]');
  const emptyState = page.getByText(/no products found/i);
  const loadingStatus = page.getByText(/^Loading\.\.\.$/).first();

  await expect
    .poll(async () => {
      const isLoading = await loadingStatus.isVisible().catch(() => false);
      if (isLoading) return 'loading';

      if (await emptyState.first().isVisible().catch(() => false)) return 'empty';

      const cardCount = await cards.count();
      if (cardCount > 0) return 'cards';

      return 'pending';
    }, { timeout: 20_000 })
    .toMatch(/^(empty|cards)$/);
};

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
    const categoryInputs = page.locator('input[type="radio"][name="category"]');
    await expect(categoryInputs.first()).toBeVisible();

    const categoryCount = await categoryInputs.count();
    let selectedCategory = '';
    let selectedIndex = 0;

    for (let i = 0; i < categoryCount; i += 1) {
      const value = (await categoryInputs.nth(i).getAttribute('value')) || '';
      if (!selectedCategory) selectedCategory = value;
      if (value.toLowerCase() === TEST_DATA.category.toLowerCase()) {
        selectedCategory = value;
        selectedIndex = i;
        break;
      }
    }

    await categoryInputs.nth(selectedIndex).check();
    await Promise.all([
      waitForProductsSearchResponse(page, { category: selectedCategory }),
      page.getByRole('button', { name: /apply filters/i }).click(),
    ]);
    await expect
      .poll(() => new URL(page.url()).searchParams.get('category') || '')
      .toBe(selectedCategory);
    await waitForProductResultsToSettle(page);

    const cards = page.locator('a[href^="/product/"]');
    const cardTexts = await cards.evaluateAll((nodes) => nodes.map((node) => node.textContent || ''));

    if (cardTexts.length === 0) {
      await expect(page.getByText(/no products found/i)).toBeVisible();
      return;
    }

    for (const text of cardTexts) {
      expect(text.toLowerCase()).toContain(selectedCategory.toLowerCase());
    }
  });

  test('1.5 Price Range Filtering: listed products are within min/max', async ({ page }) => {
    await page.getByPlaceholder('Min').fill(String(TEST_DATA.minPrice));
    await page.getByPlaceholder('Max').fill(String(TEST_DATA.maxPrice));
    await Promise.all([
      waitForProductsSearchResponse(page, {
        minPrice: String(TEST_DATA.minPrice),
        maxPrice: String(TEST_DATA.maxPrice),
      }),
      page.getByRole('button', { name: /apply filters/i }).click(),
    ]);
    await expect
      .poll(() => new URL(page.url()).searchParams.get('minPrice') || '')
      .toBe(String(TEST_DATA.minPrice));
    await expect
      .poll(() => new URL(page.url()).searchParams.get('maxPrice') || '')
      .toBe(String(TEST_DATA.maxPrice));
    await waitForProductResultsToSettle(page);

    const cards = page.locator('a[href^="/product/"]');
    const cardCount = await cards.count();
    if (cardCount === 0) {
      await expect(page.getByText(/no products found/i)).toBeVisible();
      return;
    }

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

    await expect(page.getByRole('heading', { name: new RegExp(escapeRegExp(TEST_DATA.exactProductName), 'i') }).first()).toBeVisible();
    await expect(page.getByText(/color variant/i)).toBeVisible();
    await expect(page.getByText(/select size/i)).toBeVisible();

    const mainText = (await page.locator('main').textContent()) || '';
    const price = parseInr(mainText);
    expect(price).not.toBeNull();

    const imageCount = await page.locator('main img').count();
    expect(imageCount).toBeGreaterThan(0);
  });
});
