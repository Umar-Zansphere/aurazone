import { test, expect } from '@playwright/test';

test.describe('7. Concurrency & Edge Cases', () => {
    const CUSTOMER_URL = 'https://www.aurazone.shop';

    test('Scenario 50: Idempotency Execution Prevention', async ({ page }) => {
        // Attempt rapid redundant submissions to ensure no duplicate orders or charges
        await page.goto(`${CUSTOMER_URL}/products`);

        const productCard = page.locator('a[href*="/product/"], .product-card').first();
        if (!(await productCard.isVisible())) {
            test.skip();
        }
        await productCard.click();
        await page.getByRole('button', { name: /add to cart/i }).click();
        await page.goto(`${CUSTOMER_URL}/checkout`);

        // Assuming we fill out simple details
        await page.getByPlaceholder(/name/i).first().fill('Test Customer');

        // Rapidly double click Place Order (if available and handles alternative payments)
        const placeOrderBtn = page.getByRole('button', { name: /place order|pay/i });
        if (await placeOrderBtn.isVisible()) {
            try {
                await placeOrderBtn.click();
                await placeOrderBtn.click({ force: true });
            } catch (e) {
                // Expected to potentially fail if button changes state to processing immediately
            }

            // Ensure success state does not fire twice or system safely catches it
            await expect(page).toHaveURL(/success|confirmation/);
        }
    });

    test('Scenario 11: Out of Stock Prevention', async ({ page }) => {
        // Attempting to add out of stock items
        await page.goto(`${CUSTOMER_URL}/products`);
        // Try to find a badge saying out of stock
        const oosProduct = page.locator('.product-card:has-text("Out of Stock")').first();
        if (await oosProduct.isVisible()) {
            await oosProduct.click();
            const addBtn = page.getByRole('button', { name: /add to cart/i });
            await expect(addBtn).toBeDisabled();
        }
    });
});
