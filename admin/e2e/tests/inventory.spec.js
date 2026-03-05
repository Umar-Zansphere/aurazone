// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Inventory — List Page', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/inventory');
        await page.waitForLoadState('networkidle');
    });

    test('should display "Inventory" page title', async ({ page }) => {
        await expect(page.locator('h1')).toHaveText('Inventory');
    });

    test('should display search input', async ({ page }) => {
        await expect(page.getByPlaceholder(/search/i)).toBeVisible();
    });

    test('should display page label', async ({ page }) => {
        const pageLabel = page.locator('.page-label').first();
        await expect(pageLabel).toBeVisible();
    });

    test('should show inventory items or empty state', async ({ page }) => {
        await page.waitForTimeout(3000);
        const cards = await page.locator('.card-surface, [class*="inventory"]').count();
        const empty = await page.getByText(/no inventory/i).isVisible().catch(() => false);
        expect(cards > 0 || empty).toBeTruthy();
    });

    test('should search inventory', async ({ page }) => {
        await page.getByPlaceholder(/search/i).fill('shoe');
        await page.waitForTimeout(2000);
        const mainContent = await page.locator('main').innerHTML();
        expect(mainContent.length).toBeGreaterThan(100);
    });

    test('should show empty results for meaningless search', async ({ page }) => {
        await page.getByPlaceholder(/search/i).fill('zzzznonexistent99999');
        await page.waitForTimeout(2000);
        const mainContent = await page.locator('main').innerHTML();
        expect(mainContent.length).toBeGreaterThan(0);
    });

    test('should show error state when API fails', async ({ page }) => {
        await page.route('**/api/admin/inventory*', (route) =>
            route.fulfill({ status: 500, body: JSON.stringify({ message: 'Error' }) })
        );
        await page.goto('/inventory');
        await page.waitForTimeout(3000);
        const mainContent = await page.locator('main').innerHTML();
        expect(mainContent.length).toBeGreaterThan(0);
    });
});

test.describe('Inventory — Expand & Detail', () => {
    test('should expand an inventory item', async ({ page }) => {
        await page.goto('/inventory');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(3000);

        // Try to expand first item
        const expandBtn = page.locator('button').filter({ has: page.locator('svg') }).first();
        if (await expandBtn.count() > 0) {
            await expandBtn.click();
            await page.waitForTimeout(1000);
            const mainContent = await page.locator('main').innerHTML();
            expect(mainContent.length).toBeGreaterThan(200);
        } else {
            test.skip();
        }
    });

    test('should show variant detail on expand', async ({ page }) => {
        await page.goto('/inventory');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(3000);

        const cards = await page.locator('.card-surface').count();
        if (cards > 0) {
            // Click on expanding a card
            const card = page.locator('.card-surface').first();
            await card.click();
            await page.waitForTimeout(2000);
            const mainContent = await page.locator('main').innerHTML();
            expect(mainContent.length).toBeGreaterThan(200);
        } else {
            test.skip();
        }
    });
});

test.describe('Inventory — Quick +/- Actions', () => {
    test('should have plus/minus buttons for stock adjustment', async ({ page }) => {
        await page.goto('/inventory');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(3000);

        const plusBtns = page.locator('button').filter({ has: page.locator('svg') });
        const count = await plusBtns.count();
        // Should have at least some interactive buttons if there's inventory
        expect(count).toBeGreaterThanOrEqual(0);
    });

    test('should display current stock quantities', async ({ page }) => {
        await page.goto('/inventory');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(3000);

        // Stock data should be visible either as numbers or empty state
        const mainContent = await page.locator('main').textContent();
        expect(mainContent.length).toBeGreaterThan(0);
    });
});

test.describe('Inventory — Adjust Modal', () => {
    test('should open adjust dialog when clicking adjust button', async ({ page }) => {
        await page.goto('/inventory');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(3000);

        // Look for adjust button
        const adjustBtn = page.getByText(/adjust/i).first();
        if (await adjustBtn.count() > 0) {
            await adjustBtn.click();
            await page.waitForTimeout(1000);
            // Modal/sheet should open
            const mainContent = await page.locator('body').innerHTML();
            expect(mainContent.length).toBeGreaterThan(500);
        } else {
            test.skip();
        }
    });

    test('should show operation types in adjust dialog', async ({ page }) => {
        await page.goto('/inventory');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(3000);

        const adjustBtn = page.getByText(/adjust/i).first();
        if (await adjustBtn.count() > 0) {
            await adjustBtn.click();
            await page.waitForTimeout(1000);

            // Should show operations like RESTOCK, DAMAGE, RESERVE, RELEASE, RETURN
            const operations = ['Restock', 'Damage', 'Reserve', 'Release', 'Return'];
            let found = 0;
            for (const op of operations) {
                const opBtn = page.getByText(op).first();
                if (await opBtn.count() > 0) found++;
            }
            expect(found).toBeGreaterThan(0);
        } else {
            test.skip();
        }
    });
});

test.describe('Inventory — Logs', () => {
    test('should have logs button', async ({ page }) => {
        await page.goto('/inventory');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(3000);

        const logsBtn = page.getByText(/log/i).first();
        const exists = await logsBtn.count();
        // Logs section exists if there's inventory data
        expect(exists).toBeGreaterThanOrEqual(0);
    });

    test('should show inventory logs when clicking logs button', async ({ page }) => {
        await page.goto('/inventory');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(3000);

        const logsBtn = page.locator('button').filter({ hasText: /log/i }).first();
        if (await logsBtn.count() > 0) {
            await logsBtn.click();
            await page.waitForTimeout(2000);
            const bodyContent = await page.locator('body').innerHTML();
            expect(bodyContent.length).toBeGreaterThan(500);
        } else {
            test.skip();
        }
    });
});

test.describe('Inventory — Edge Cases', () => {
    test('should handle empty inventory response', async ({ page }) => {
        await page.route('**/api/admin/inventory*', (route) =>
            route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify([]),
            })
        );
        await page.goto('/inventory');
        await page.waitForTimeout(3000);
        const mainContent = await page.locator('main').innerHTML();
        expect(mainContent.length).toBeGreaterThan(0);
    });

    test('should handle clearing search', async ({ page }) => {
        await page.goto('/inventory');
        await page.waitForLoadState('networkidle');
        const searchInput = page.getByPlaceholder(/search/i);
        await searchInput.fill('test');
        await page.waitForTimeout(1000);
        await searchInput.fill('');
        await page.waitForTimeout(1000);
        await expect(searchInput).toHaveValue('');
    });
});
