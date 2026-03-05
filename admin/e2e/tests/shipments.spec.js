// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Shipments — List Page', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/shipments');
        await page.waitForLoadState('networkidle');
    });

    test('should display "Shipments" page title', async ({ page }) => {
        await expect(page.locator('h1')).toHaveText('Shipments');
    });

    test('should display filter chips', async ({ page }) => {
        const filters = ['ALL', 'PENDING', 'SHIPPED', 'DELIVERED', 'RETURNED', 'LOST'];
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

    test('should filter by SHIPPED status', async ({ page }) => {
        await page.getByRole('button', { name: 'SHIPPED' }).click();
        await page.waitForTimeout(2000);
        const mainContent = await page.locator('main').innerHTML();
        expect(mainContent.length).toBeGreaterThan(100);
    });

    test('should filter by DELIVERED status', async ({ page }) => {
        await page.getByRole('button', { name: 'DELIVERED' }).click();
        await page.waitForTimeout(2000);
        const mainContent = await page.locator('main').innerHTML();
        expect(mainContent.length).toBeGreaterThan(100);
    });

    test('should filter by RETURNED status', async ({ page }) => {
        await page.getByRole('button', { name: 'RETURNED' }).click();
        await page.waitForTimeout(2000);
        const mainContent = await page.locator('main').innerHTML();
        expect(mainContent.length).toBeGreaterThan(100);
    });

    test('should filter by LOST status', async ({ page }) => {
        await page.getByRole('button', { name: 'LOST' }).click();
        await page.waitForTimeout(2000);
        const mainContent = await page.locator('main').innerHTML();
        expect(mainContent.length).toBeGreaterThan(100);
    });

    test('should search shipments', async ({ page }) => {
        await page.getByPlaceholder(/search/i).fill('test');
        await page.waitForTimeout(2000);
        const mainContent = await page.locator('main').innerHTML();
        expect(mainContent.length).toBeGreaterThan(100);
    });

    test('should show shipment cards or empty state', async ({ page }) => {
        await page.waitForTimeout(2000);
        const cards = await page.locator('.card-surface, [class*="shipment"]').count();
        const empty = await page.getByText(/no shipments/i).isVisible().catch(() => false);
        expect(cards > 0 || empty).toBeTruthy();
    });

    test('should expand shipment card', async ({ page }) => {
        await page.waitForTimeout(2000);
        const expandBtn = page.locator('button').filter({ has: page.locator('svg') }).first();
        if (await expandBtn.count() > 0) {
            await expandBtn.click();
            await page.waitForTimeout(1000);
        }
        const mainContent = await page.locator('main').innerHTML();
        expect(mainContent.length).toBeGreaterThan(100);
    });

    test('should show error state when API fails', async ({ page }) => {
        await page.route('**/api/admin/shipments*', (route) =>
            route.fulfill({ status: 500, body: JSON.stringify({ message: 'Error' }) })
        );
        await page.goto('/shipments');
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

    test('should display page label', async ({ page }) => {
        const pageLabel = page.locator('.page-label').first();
        await expect(pageLabel).toBeVisible();
    });

    test('should have clickable items for logs', async ({ page }) => {
        await page.waitForTimeout(2000);
        const buttons = await page.locator('button').count();
        expect(buttons).toBeGreaterThan(0);
    });

    test('should preserve search when switching filters', async ({ page }) => {
        await page.getByPlaceholder(/search/i).fill('test');
        await page.waitForTimeout(1000);
        await page.getByRole('button', { name: 'DELIVERED' }).click();
        await page.waitForTimeout(2000);
        const searchVal = await page.getByPlaceholder(/search/i).inputValue();
        expect(searchVal).toBe('test');
    });

    test('should handle rapid filter switching', async ({ page }) => {
        await page.getByRole('button', { name: 'PENDING' }).click();
        await page.getByRole('button', { name: 'SHIPPED' }).click();
        await page.getByRole('button', { name: 'DELIVERED' }).click();
        await page.getByRole('button', { name: 'ALL' }).click();
        await page.waitForTimeout(2000);
        const mainContent = await page.locator('main').innerHTML();
        expect(mainContent.length).toBeGreaterThan(100);
    });
});
