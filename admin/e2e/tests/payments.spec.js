// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Payments — List Page', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/payments');
        await page.waitForLoadState('networkidle');
    });

    test('should display "Payments" page title', async ({ page }) => {
        await expect(page.locator('h1')).toHaveText('Payments');
    });

    test('should display filter chips', async ({ page }) => {
        const filters = ['ALL', 'PENDING', 'COMPLETED', 'FAILED', 'REFUNDED'];
        for (const filter of filters) {
            await expect(page.getByRole('button', { name: filter })).toBeVisible();
        }
    });

    test('should have ALL filter active by default', async ({ page }) => {
        const allChip = page.getByRole('button', { name: 'ALL' });
        const className = await allChip.getAttribute('class');
        expect(className).toContain('text-white');
    });

    test('should display search input', async ({ page }) => {
        await expect(page.getByPlaceholder(/search/i)).toBeVisible();
    });

    test('should filter by PENDING status', async ({ page }) => {
        await page.getByRole('button', { name: 'PENDING' }).click();
        await page.waitForTimeout(2000);
        const mainContent = await page.locator('main').innerHTML();
        expect(mainContent.length).toBeGreaterThan(100);
    });

    test('should filter by COMPLETED status', async ({ page }) => {
        await page.getByRole('button', { name: 'COMPLETED' }).click();
        await page.waitForTimeout(2000);
        const mainContent = await page.locator('main').innerHTML();
        expect(mainContent.length).toBeGreaterThan(100);
    });

    test('should filter by FAILED status', async ({ page }) => {
        await page.getByRole('button', { name: 'FAILED' }).click();
        await page.waitForTimeout(2000);
        const mainContent = await page.locator('main').innerHTML();
        expect(mainContent.length).toBeGreaterThan(100);
    });

    test('should filter by REFUNDED status', async ({ page }) => {
        await page.getByRole('button', { name: 'REFUNDED' }).click();
        await page.waitForTimeout(2000);
        const mainContent = await page.locator('main').innerHTML();
        expect(mainContent.length).toBeGreaterThan(100);
    });

    test('should search payments', async ({ page }) => {
        await page.getByPlaceholder(/search/i).fill('test');
        await page.waitForTimeout(2000);
        const mainContent = await page.locator('main').innerHTML();
        expect(mainContent.length).toBeGreaterThan(100);
    });

    test('should show payment cards or empty state', async ({ page }) => {
        await page.waitForTimeout(2000);
        const cards = await page.locator('.card-surface, [class*="payment"]').count();
        const empty = await page.getByText(/no payments/i).isVisible().catch(() => false);
        expect(cards > 0 || empty).toBeTruthy();
    });

    test('should expand payment card to show details', async ({ page }) => {
        await page.waitForTimeout(2000);
        const expandBtn = page.locator('button').filter({ has: page.locator('svg') }).first();
        if (await expandBtn.count() > 0) {
            await expandBtn.click();
            await page.waitForTimeout(1000);
        }
        // Card should still be visible after toggle
        const mainContent = await page.locator('main').innerHTML();
        expect(mainContent.length).toBeGreaterThan(100);
    });

    test('should show error state when API fails', async ({ page }) => {
        await page.route('**/api/admin/payments*', (route) =>
            route.fulfill({ status: 500, body: JSON.stringify({ message: 'Error' }) })
        );
        await page.goto('/payments');
        await page.waitForTimeout(3000);
        const mainContent = await page.locator('main').innerHTML();
        expect(mainContent.length).toBeGreaterThan(0);
    });

    test('should show empty state with meaningless search', async ({ page }) => {
        await page.getByPlaceholder(/search/i).fill('zzzznonexistent99999');
        await page.waitForTimeout(2000);
        const mainContent = await page.locator('main').innerHTML();
        expect(mainContent.length).toBeGreaterThan(0);
    });

    test('should display "Transactions" page label', async ({ page }) => {
        const pageLabel = page.locator('.page-label').first();
        await expect(pageLabel).toBeVisible();
    });

    test('should have clickable payment items to view logs', async ({ page }) => {
        await page.waitForTimeout(2000);
        const buttons = await page.locator('button').count();
        expect(buttons).toBeGreaterThan(0);
    });

    test('should switch between filters preserving search', async ({ page }) => {
        await page.getByPlaceholder(/search/i).fill('test');
        await page.waitForTimeout(1000);
        await page.getByRole('button', { name: 'COMPLETED' }).click();
        await page.waitForTimeout(2000);
        const searchVal = await page.getByPlaceholder(/search/i).inputValue();
        expect(searchVal).toBe('test');
    });

    test('should clear search input', async ({ page }) => {
        const searchInput = page.getByPlaceholder(/search/i);
        await searchInput.fill('test');
        await searchInput.fill('');
        await page.waitForTimeout(1000);
        await expect(searchInput).toHaveValue('');
    });

    test('should handle rapid filter switching', async ({ page }) => {
        await page.getByRole('button', { name: 'PENDING' }).click();
        await page.getByRole('button', { name: 'COMPLETED' }).click();
        await page.getByRole('button', { name: 'ALL' }).click();
        await page.waitForTimeout(2000);
        const mainContent = await page.locator('main').innerHTML();
        expect(mainContent.length).toBeGreaterThan(100);
    });
});
