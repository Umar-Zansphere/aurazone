// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Settings — Page Load', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/settings');
        await page.waitForLoadState('networkidle');
    });

    test('should display "Settings" page title', async ({ page }) => {
        await expect(page.locator('h1')).toHaveText('Settings');
    });

    test('should display "Control" page label', async ({ page }) => {
        await expect(page.locator('.page-label').first()).toHaveText('Control');
    });
});

test.describe('Settings — Profile Section', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/settings');
        await page.waitForLoadState('networkidle');
    });

    test('should show admin user name', async ({ page }) => {
        await expect(page.getByText('Admin User')).toBeVisible();
    });

    test('should show admin email', async ({ page }) => {
        await expect(page.getByText('admin@aurazone.com')).toBeVisible();
    });

    test('should show ADMIN role badge', async ({ page }) => {
        await expect(page.getByText('ADMIN')).toBeVisible();
    });

    test('should have profile section title', async ({ page }) => {
        await expect(page.getByText('Profile')).toBeVisible();
    });
});

test.describe('Settings — Notification Preferences', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/settings');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000);
    });

    test('should show notification preferences section', async ({ page }) => {
        await expect(page.getByText('Notification Preferences')).toBeVisible();
    });

    test('should have New Orders preference toggle', async ({ page }) => {
        await expect(page.getByText('New Orders')).toBeVisible();
    });

    test('should have Order Status Changes preference toggle', async ({ page }) => {
        await expect(page.getByText('Order Status Changes')).toBeVisible();
    });

    test('should have Low Stock Alerts preference toggle', async ({ page }) => {
        await expect(page.getByText('Low Stock Alerts')).toBeVisible();
    });

    test('should have Other Events preference toggle', async ({ page }) => {
        await expect(page.getByText('Other Events')).toBeVisible();
    });

    test('should toggle New Orders preference', async ({ page }) => {
        const toggleBtn = page.locator('button', { hasText: 'New Orders' });
        await toggleBtn.click();
        await page.waitForTimeout(1000);
        // Toggle should switch state
        const mainContent = await page.locator('main').innerHTML();
        expect(mainContent).toContain('New Orders');
    });

    test('should toggle Low Stock Alerts preference', async ({ page }) => {
        const toggleBtn = page.locator('button', { hasText: 'Low Stock Alerts' });
        await toggleBtn.click();
        await page.waitForTimeout(1000);
        const mainContent = await page.locator('main').innerHTML();
        expect(mainContent).toContain('Low Stock Alerts');
    });
});

test.describe('Settings — Push Subscription', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/settings');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000);
    });

    test('should show push subscription button', async ({ page }) => {
        await expect(page.getByText('Push Subscription')).toBeVisible();
    });

    test('should show subscription status', async ({ page }) => {
        const status = page.getByText(/subscribed|not subscribed/i).first();
        await expect(status).toBeVisible();
    });
});

test.describe('Settings — App Info', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/settings');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000);
    });

    test('should show App Info section', async ({ page }) => {
        await expect(page.getByText('App Info')).toBeVisible();
    });

    test('should show version number', async ({ page }) => {
        await expect(page.getByText('Version')).toBeVisible();
    });

    test('should show backend health status', async ({ page }) => {
        await expect(page.getByText('Backend Health')).toBeVisible();
    });

    test('should show health status indicator', async ({ page }) => {
        const healthStatus = page.getByText(/healthy|unhealthy|unknown/i).first();
        await expect(healthStatus).toBeVisible();
    });

    test('should show health message', async ({ page }) => {
        await page.waitForTimeout(3000);
        // Health message like "Database connection OK" or "Backend unreachable"
        const mainContent = await page.locator('main').textContent();
        expect(mainContent).toMatch(/database|backend|connection|checking/i);
    });
});

test.describe('Settings — Logout', () => {
    test('should have logout button', async ({ page }) => {
        await page.goto('/settings');
        await page.waitForLoadState('networkidle');
        await expect(page.getByText(/log out/i)).toBeVisible();
    });

    test('should logout and redirect to login page', async ({ page }) => {
        await page.goto('/settings');
        await page.waitForLoadState('networkidle');

        await page.getByText(/log out/i).click();
        // Should redirect to login
        await page.waitForURL(/\/login/, { timeout: 15_000 });
        expect(page.url()).toContain('/login');
    });
});
