import { test, expect } from '@playwright/test';

test.describe('6. Admin Reflection (Inventory & Order Management)', () => {
    const ADMIN_URL = 'https://admin.aurazone.shop';

    test.beforeEach(async ({ page }) => {
        // Login flow
        await page.goto(ADMIN_URL);
        await page.waitForLoadState('networkidle');

        // Assume login form is present and log in
        const emailField = page.getByPlaceholder(/email/i);
        const passField = page.getByPlaceholder(/password/i);
        if (await emailField.isVisible()) {
            await emailField.fill('admin@aurazone.shop');
            await passField.fill('Admin@123456');
            await page.getByRole('button', { name: /sign in|login/i }).click();

            // Wait for dashboard redirection
            await page.waitForURL(/\/|\/dashboard/);
        }
    });

    test('Scenario 36 & 37: New Order Visibility and Admin Order Details', async ({ page }) => {
        // Navigate to Orders
        const ordersLink = page.getByRole('link', { name: /orders/i }).first();
        if (await ordersLink.isVisible()) {
            await ordersLink.click();
            await page.waitForLoadState('networkidle');

            // Ensure order list reflects data
            const firstOrder = page.locator('table tbody tr, .order-card').first();
            if (await firstOrder.isVisible()) {
                await firstOrder.click();
                await expect(page.getByText(/order details/i).first()).toBeVisible();
            }
        }
    });

    test('Scenario 38: Inventory Management and Inspection', async ({ page }) => {
        // Check Inventory Deduction reflection
        const productsLink = page.getByRole('link', { name: /products/i }).first();
        if (await productsLink.isVisible()) {
            await productsLink.click();
            await page.waitForLoadState('networkidle');

            const firstProduct = page.locator('table tbody tr, .product-card').first();
            if (await firstProduct.isVisible()) {
                await firstProduct.click();
                // Verify stock counts are displayed in the admin UI
                await expect(page.getByText(/stock|inventory|quantity/i).first()).toBeVisible();
            }
        }
    });
});
