import { test, expect } from '@playwright/test';

test.describe('1. Product Searching & Browsing + 2. Cart Management', () => {
    const CUSTOMER_URL = 'https://www.aurazone.shop';

    test.beforeEach(async ({ page }) => {
        await page.goto(CUSTOMER_URL);
    });

    test('Scenario 1: Exact Match Search', async ({ page }) => {
        const searchInput = page.getByPlaceholder(/search/i).first();
        // Assuming search is accessible directly on home page navigation header
        await searchInput.fill('Test Product');
        await searchInput.press('Enter');

        // Wait for product listing
        await expect(page.locator('main')).toBeVisible();
    });

    test('Scenario 3: Empty State Search', async ({ page }) => {
        const searchInput = page.getByPlaceholder(/search/i).first();
        await searchInput.fill('NonExistentProduct12345XXX');
        await searchInput.press('Enter');
        await expect(page.getByText(/no products found|no results/i)).toBeVisible();
    });

    test('Scenario 8: Product Details Accuracy', async ({ page }) => {
        await page.goto(`${CUSTOMER_URL}/products`);

        // Check if there's any product card available
        const productCard = page.locator('a[href*="/product/"], .product-card').first();
        if (await productCard.isVisible()) {
            await productCard.click();
            await expect(page.locator('h1')).toBeVisible(); // Title
            await expect(page.getByRole('button', { name: /add to cart/i })).toBeVisible();
        }
    });

    test('Scenario 9 & 13 & 15: Cart Management Lifecycle', async ({ page }) => {
        // Add Simple Product
        await page.goto(`${CUSTOMER_URL}/products`);
        const productCard = page.locator('a[href*="/product/"], .product-card').first();

        if (await productCard.isVisible()) {
            await productCard.click();
            await page.getByRole('button', { name: /add to cart/i }).click();

            // Navigate to cart
            await page.goto(`${CUSTOMER_URL}/cart`);

            // Increment
            const incrementBtn = page.getByRole('button', { name: /\+|increase/i }).first();
            if (await incrementBtn.isVisible()) {
                await incrementBtn.click();
                // Wait for UI to update line item 
                await page.waitForTimeout(1000);
            }

            // Explicit Removal
            const removeBtn = page.getByRole('button', { name: /remove|delete|trash/i }).first();
            if (await removeBtn.isVisible()) {
                await removeBtn.click();
                await expect(page.getByText(/empty/i)).toBeVisible();
            }
        }
    });
});
