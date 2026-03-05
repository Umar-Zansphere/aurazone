// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Analytics — Page Load', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/analytics');
        await page.waitForLoadState('networkidle');
    });

    test('should display "Analytics" page title', async ({ page }) => {
        await expect(page.locator('h1')).toHaveText('Analytics');
    });

    test('should display "Insights" page label', async ({ page }) => {
        await expect(page.locator('.page-label').first()).toHaveText('Insights');
    });

    test('should display period chips', async ({ page }) => {
        const periods = ['TODAY', '7D', '30D', '90D', 'CUSTOM'];
        for (const period of periods) {
            await expect(page.getByRole('button', { name: period })).toBeVisible();
        }
    });

    test('should have 7D period selected by default', async ({ page }) => {
        const chip7d = page.getByRole('button', { name: '7D' });
        const className = await chip7d.getAttribute('class');
        expect(className).toContain('text-white');
    });
});

test.describe('Analytics — Period Switching', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/analytics');
        await page.waitForLoadState('networkidle');
    });

    test('should switch to TODAY period', async ({ page }) => {
        await page.getByRole('button', { name: 'TODAY' }).click();
        await page.waitForTimeout(2000);
        const todayChip = page.getByRole('button', { name: 'TODAY' });
        const className = await todayChip.getAttribute('class');
        expect(className).toContain('text-white');
    });

    test('should switch to 30D period', async ({ page }) => {
        await page.getByRole('button', { name: '30D' }).click();
        await page.waitForTimeout(2000);
        const chip = page.getByRole('button', { name: '30D' });
        const className = await chip.getAttribute('class');
        expect(className).toContain('text-white');
    });

    test('should switch to 90D period', async ({ page }) => {
        await page.getByRole('button', { name: '90D' }).click();
        await page.waitForTimeout(2000);
        const chip = page.getByRole('button', { name: '90D' });
        const className = await chip.getAttribute('class');
        expect(className).toContain('text-white');
    });

    test('should show custom date inputs when CUSTOM is selected', async ({ page }) => {
        await page.getByRole('button', { name: 'CUSTOM' }).click();
        await page.waitForTimeout(1000);
        // Date inputs should appear
        const dateInputs = page.locator('input[type="date"]');
        const count = await dateInputs.count();
        expect(count).toBeGreaterThanOrEqual(2);
    });

    test('should fill custom date range', async ({ page }) => {
        await page.getByRole('button', { name: 'CUSTOM' }).click();
        await page.waitForTimeout(1000);
        const dateInputs = page.locator('input[type="date"]');
        await dateInputs.nth(0).fill('2026-01-01');
        await dateInputs.nth(1).fill('2026-02-28');
        await page.waitForTimeout(3000);
        // Data should be fetched for custom range
        const mainContent = await page.locator('main').innerHTML();
        expect(mainContent.length).toBeGreaterThan(200);
    });
});

test.describe('Analytics — Data Display', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/analytics');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(3000);
    });

    test('should show revenue section or empty state', async ({ page }) => {
        const hasRevenue = await page.getByText(/total revenue/i).isVisible().catch(() => false);
        const hasEmpty = await page.getByText(/no analytics/i).isVisible().catch(() => false);
        expect(hasRevenue || hasEmpty).toBeTruthy();
    });

    test('should show order breakdown section or empty state', async ({ page }) => {
        const hasBreakdown = await page.getByText(/order breakdown/i).isVisible().catch(() => false);
        const hasEmpty = await page.getByText(/no analytics/i).isVisible().catch(() => false);
        expect(hasBreakdown || hasEmpty).toBeTruthy();
    });

    test('should show top products section or empty state', async ({ page }) => {
        const hasTopProducts = await page.getByText(/top products/i).isVisible().catch(() => false);
        const hasEmpty = await page.getByText(/no analytics/i).isVisible().catch(() => false);
        expect(hasTopProducts || hasEmpty).toBeTruthy();
    });

    test('should render charts (recharts containers)', async ({ page }) => {
        const hasCharts = await page.locator('.recharts-responsive-container').count() > 0;
        const hasEmpty = await page.getByText(/no analytics/i).isVisible().catch(() => false);
        expect(hasCharts || hasEmpty).toBeTruthy();
    });
});

test.describe('Analytics — Error Handling', () => {
    test('should show error state when API fails', async ({ page }) => {
        await page.route('**/api/admin/analytics*', (route) =>
            route.fulfill({ status: 500, body: JSON.stringify({ message: 'Error' }) })
        );
        await page.goto('/analytics');
        await page.waitForTimeout(3000);
        await expect(page.getByText(/failed to load analytics/i)).toBeVisible({ timeout: 15_000 });
    });

    test('should show retry button on error state', async ({ page }) => {
        await page.route('**/api/admin/analytics*', (route) =>
            route.fulfill({ status: 500, body: JSON.stringify({ message: 'Error' }) })
        );
        await page.goto('/analytics');
        await page.waitForTimeout(3000);
        await expect(page.getByRole('button', { name: /retry/i })).toBeVisible({ timeout: 15_000 });
    });

    test('should reload data when retry is clicked', async ({ page }) => {
        let callCount = 0;
        await page.route('**/api/admin/analytics*', (route) => {
            callCount++;
            if (callCount === 1) {
                return route.fulfill({ status: 500, body: JSON.stringify({ message: 'Error' }) });
            }
            return route.continue();
        });
        await page.goto('/analytics');
        await page.waitForTimeout(3000);
        const retryBtn = page.getByRole('button', { name: /retry/i });
        if (await retryBtn.count() > 0) {
            await retryBtn.click();
            await page.waitForTimeout(3000);
            expect(callCount).toBeGreaterThanOrEqual(2);
        }
    });

    test('should show skeleton while loading', async ({ page }) => {
        await page.route('**/api/admin/analytics*', async (route) => {
            await new Promise((r) => setTimeout(r, 3000));
            await route.continue();
        });
        await page.goto('/analytics');
        const skeleton = page.locator('.skeleton').first();
        await expect(skeleton).toBeVisible();
    });
});
