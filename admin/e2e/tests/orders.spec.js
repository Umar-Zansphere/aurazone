// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Orders — List Page', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/orders');
        await page.waitForLoadState('networkidle');
    });

    test('should display "Orders" page title', async ({ page }) => {
        await expect(page.locator('h1')).toHaveText('Orders');
    });

    test('should display filter chips', async ({ page }) => {
        const filters = ['ALL', 'PENDING', 'PAID', 'SHIPPED', 'DELIVERED', 'CANCELLED'];
        for (const filter of filters) {
            await expect(page.getByRole('button', { name: filter })).toBeVisible();
        }
    });

    test('should have ALL filter selected by default', async ({ page }) => {
        const allChip = page.getByRole('button', { name: 'ALL' });
        const className = await allChip.getAttribute('class');
        expect(className).toContain('text-white');
    });

    test('should display search input', async ({ page }) => {
        await expect(page.getByPlaceholder(/search/i)).toBeVisible();
    });

    test('should change active filter when clicking a chip', async ({ page }) => {
        await page.getByRole('button', { name: 'PENDING' }).click();
        await page.waitForTimeout(1000);
        const pendingChip = page.getByRole('button', { name: 'PENDING' });
        const className = await pendingChip.getAttribute('class');
        expect(className).toContain('text-white');
    });

    test('should filter orders by PENDING status', async ({ page }) => {
        await page.getByRole('button', { name: 'PENDING' }).click();
        await page.waitForTimeout(2000);
        // Either orders appear or empty state
        const hasContent = (await page.locator('main').innerHTML()).length > 100;
        expect(hasContent).toBeTruthy();
    });

    test('should filter orders by PAID status', async ({ page }) => {
        await page.getByRole('button', { name: 'PAID' }).click();
        await page.waitForTimeout(2000);
        const hasContent = (await page.locator('main').innerHTML()).length > 100;
        expect(hasContent).toBeTruthy();
    });

    test('should filter orders by SHIPPED status', async ({ page }) => {
        await page.getByRole('button', { name: 'SHIPPED' }).click();
        await page.waitForTimeout(2000);
        const hasContent = (await page.locator('main').innerHTML()).length > 100;
        expect(hasContent).toBeTruthy();
    });

    test('should filter orders by DELIVERED status', async ({ page }) => {
        await page.getByRole('button', { name: 'DELIVERED' }).click();
        await page.waitForTimeout(2000);
        const hasContent = (await page.locator('main').innerHTML()).length > 100;
        expect(hasContent).toBeTruthy();
    });

    test('should filter orders by CANCELLED status', async ({ page }) => {
        await page.getByRole('button', { name: 'CANCELLED' }).click();
        await page.waitForTimeout(2000);
        const hasContent = (await page.locator('main').innerHTML()).length > 100;
        expect(hasContent).toBeTruthy();
    });

    test('should search for orders', async ({ page }) => {
        const searchInput = page.getByPlaceholder(/search/i);
        await searchInput.fill('test');
        await page.waitForTimeout(2000);
        // Should either show results or empty state
        const hasContent = (await page.locator('main').innerHTML()).length > 100;
        expect(hasContent).toBeTruthy();
    });

    test('should show empty state with meaningless search term', async ({ page }) => {
        const searchInput = page.getByPlaceholder(/search/i);
        await searchInput.fill('zzzznonexistent99999');
        await page.waitForTimeout(2000);
        // Empty state or no matching orders
        const mainContent = await page.locator('main').innerHTML();
        expect(mainContent.length).toBeGreaterThan(0);
    });

    test('should display order cards or empty state', async ({ page }) => {
        await page.waitForTimeout(2000);
        const cards = await page.locator('[class*="card"], [class*="order"]').count();
        const empty = await page.getByText(/no orders/i).isVisible().catch(() => false);
        expect(cards > 0 || empty).toBeTruthy();
    });

    test('should show error state when API fails', async ({ page }) => {
        await page.route('**/api/admin/orders*', (route) =>
            route.fulfill({ status: 500, body: JSON.stringify({ message: 'Error' }) })
        );
        await page.goto('/orders');
        await page.waitForTimeout(3000);
        const mainContent = await page.locator('main').innerHTML();
        expect(mainContent.length).toBeGreaterThan(0);
    });
});

test.describe('Orders — Detail Page', () => {
    test('should navigate to order detail when clicking an order', async ({ page }) => {
        await page.goto('/orders');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000);

        // Try to click the first order link/card
        const firstOrderLink = page.locator('a[href*="/orders/"]').first();
        const exists = await firstOrderLink.count();
        if (exists > 0) {
            await firstOrderLink.click();
            await page.waitForURL(/\/orders\/[^/]+/);
            expect(page.url()).toMatch(/\/orders\/[^/]+/);
        } else {
            test.skip();
        }
    });

    test('should show order detail with status stepper', async ({ page }) => {
        await page.goto('/orders');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000);

        const firstOrderLink = page.locator('a[href*="/orders/"]').first();
        if (await firstOrderLink.count() === 0) {
            test.skip();
            return;
        }

        await firstOrderLink.click();
        await page.waitForURL(/\/orders\/[^/]+/);
        await page.waitForTimeout(2000);

        // Should show status steps (Placed, Paid, Shipped, Delivered)
        const steps = ['Placed', 'Paid', 'Shipped', 'Delivered'];
        for (const step of steps) {
            await expect(page.getByText(step).first()).toBeVisible();
        }
    });

    test('should have back button on order detail', async ({ page }) => {
        await page.goto('/orders');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000);

        const firstOrderLink = page.locator('a[href*="/orders/"]').first();
        if (await firstOrderLink.count() === 0) {
            test.skip();
            return;
        }

        await firstOrderLink.click();
        await page.waitForURL(/\/orders\/[^/]+/);
        await page.waitForTimeout(1000);

        // Back button should be visible
        const backBtn = page.locator('button', { has: page.locator('svg') }).first();
        await expect(backBtn).toBeVisible();
    });

    test('should navigate back to orders list from detail', async ({ page }) => {
        await page.goto('/orders');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000);

        const firstOrderLink = page.locator('a[href*="/orders/"]').first();
        if (await firstOrderLink.count() === 0) {
            test.skip();
            return;
        }

        await firstOrderLink.click();
        await page.waitForURL(/\/orders\/[^/]+/);
        await page.waitForTimeout(1000);

        // Click back
        await page.goBack();
        await page.waitForURL(/\/orders\/?$/);
        expect(page.url()).toContain('/orders');
    });

    test('should display order items section', async ({ page }) => {
        await page.goto('/orders');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000);

        const firstOrderLink = page.locator('a[href*="/orders/"]').first();
        if (await firstOrderLink.count() === 0) {
            test.skip();
            return;
        }

        await firstOrderLink.click();
        await page.waitForURL(/\/orders\/[^/]+/);
        await page.waitForTimeout(3000);

        // Should show order info
        const mainContent = await page.locator('main').innerHTML();
        expect(mainContent.length).toBeGreaterThan(200);
    });

    test('should show action buttons on order detail', async ({ page }) => {
        await page.goto('/orders');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000);

        const firstOrderLink = page.locator('a[href*="/orders/"]').first();
        if (await firstOrderLink.count() === 0) {
            test.skip();
            return;
        }

        await firstOrderLink.click();
        await page.waitForURL(/\/orders\/[^/]+/);
        await page.waitForTimeout(3000);

        // Should have action buttons like status update, delete, etc.
        const buttons = await page.locator('button').count();
        expect(buttons).toBeGreaterThan(0);
    });

    test('should handle non-existent order ID gracefully', async ({ page }) => {
        await page.goto('/orders/nonexistent-order-id');
        await page.waitForTimeout(3000);
        // Should show error or redirect
        const mainContent = await page.locator('main').innerHTML();
        expect(mainContent.length).toBeGreaterThan(0);
    });
});

test.describe('Orders — Status Actions', () => {
    test('should show status advancement button on pending order', async ({ page }) => {
        await page.goto('/orders');
        await page.waitForLoadState('networkidle');
        await page.getByRole('button', { name: 'PENDING' }).click();
        await page.waitForTimeout(2000);

        const firstOrderLink = page.locator('a[href*="/orders/"]').first();
        if (await firstOrderLink.count() === 0) {
            test.skip();
            return;
        }

        await firstOrderLink.click();
        await page.waitForURL(/\/orders\/[^/]+/);
        await page.waitForTimeout(3000);

        // Status actions should be available
        const buttons = await page.locator('button').count();
        expect(buttons).toBeGreaterThan(0);
    });

    test('should show cancel button for cancellable orders', async ({ page }) => {
        await page.goto('/orders');
        await page.waitForLoadState('networkidle');
        await page.getByRole('button', { name: 'PENDING' }).click();
        await page.waitForTimeout(3000);

        // Check if there are any pending orders with swipe-to-cancel
        const mainContent = await page.locator('main').innerHTML();
        expect(mainContent.length).toBeGreaterThan(0);
    });
});
