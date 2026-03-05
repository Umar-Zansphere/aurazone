// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Navigation — Desktop Sidebar', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('networkidle');
    });

    test('should display sidebar with AuraZone label', async ({ page }) => {
        await expect(page.locator('aside').first()).toBeVisible();
        await expect(page.locator('aside').getByText('AuraZone')).toBeVisible();
    });

    test('should have "Create New" button in sidebar', async ({ page }) => {
        await expect(page.locator('aside').getByText('Create New')).toBeVisible();
    });

    test('should navigate to /products/new when "Create New" is clicked', async ({ page }) => {
        await page.locator('aside').getByText('Create New').click();
        await page.waitForURL(/\/products\/new/);
        expect(page.url()).toContain('/products/new');
    });

    const sidebarLinks = [
        { label: 'Dashboard', path: '/' },
        { label: 'Orders', path: '/orders' },
        { label: 'Products', path: '/products' },
        { label: 'Inventory', path: '/inventory' },
        { label: 'Payments', path: '/payments' },
        { label: 'Shipments', path: '/shipments' },
        { label: 'Analytics', path: '/analytics' },
        { label: 'Notifications', path: '/notifications' },
    ];

    for (const link of sidebarLinks) {
        test(`should navigate to ${link.path} when "${link.label}" is clicked`, async ({ page }) => {
            await page.locator('aside').getByText(link.label, { exact: true }).click();
            await page.waitForLoadState('networkidle');
            if (link.path === '/') {
                await expect(page).toHaveURL(/\/$/);
            } else {
                expect(page.url()).toContain(link.path);
            }
        });
    }

    test('should navigate to /settings when "Settings" is clicked', async ({ page }) => {
        await page.locator('aside').getByText('Settings', { exact: true }).click();
        await page.waitForLoadState('networkidle');
        expect(page.url()).toContain('/settings');
    });

    test('should highlight active sidebar link', async ({ page }) => {
        // On dashboard, "Dashboard" should have active styling
        const dashLink = page.locator('aside a', { hasText: 'Dashboard' });
        const className = await dashLink.getAttribute('class');
        expect(className).toContain('highlight');
    });

    test('should show admin user info in sidebar', async ({ page }) => {
        await expect(page.locator('aside').getByText('Admin User')).toBeVisible();
        await expect(page.locator('aside').getByText('admin@aurazone.com')).toBeVisible();
    });
});

test.describe('Navigation — Mobile Bottom Tab Bar', () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('networkidle');
    });

    test('should display bottom tab bar on mobile viewport', async ({ page }) => {
        // Bottom tab bar is visible on mobile (md:hidden means hidden on desktop)
        const tabBar = page.locator('nav.fixed').first();
        await expect(tabBar).toBeVisible();
    });

    test('should have Home tab', async ({ page }) => {
        await expect(page.locator('nav.fixed').getByText('Home')).toBeVisible();
    });

    test('should have Orders tab', async ({ page }) => {
        await expect(page.locator('nav.fixed').getByText('Orders')).toBeVisible();
    });

    test('should have Products tab', async ({ page }) => {
        await expect(page.locator('nav.fixed').getByText('Products')).toBeVisible();
    });

    test('should have Profile tab', async ({ page }) => {
        await expect(page.locator('nav.fixed').getByText('Profile')).toBeVisible();
    });

    test('should navigate to orders when Orders tab is clicked', async ({ page }) => {
        await page.locator('nav.fixed').getByText('Orders').click();
        await page.waitForURL(/\/orders/);
        expect(page.url()).toContain('/orders');
    });

    test('should navigate to products when Products tab is clicked', async ({ page }) => {
        await page.locator('nav.fixed').getByText('Products').click();
        await page.waitForURL(/\/products/);
        expect(page.url()).toContain('/products');
    });

    test('should navigate to settings when Profile tab is clicked', async ({ page }) => {
        await page.locator('nav.fixed').getByText('Profile').click();
        await page.waitForURL(/\/settings/);
        expect(page.url()).toContain('/settings');
    });
});
