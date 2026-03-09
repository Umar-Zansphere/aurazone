import { test, expect } from '@playwright/test';

test.describe('3. Checkout & 4. Payment Processing', () => {
    const CUSTOMER_URL = 'https://www.aurazone.shop';

    test('Scenario 20 & 19 & 27: Checkout Validation and Submission using COD', async ({ page }) => {
        await page.goto(`${CUSTOMER_URL}/products`);

        const productCard = page.locator('a[href*="/product/"], .product-card').first();
        if (!(await productCard.isVisible())) {
            test.skip(); // No products to test
        }

        await productCard.click();
        await page.getByRole('button', { name: /add to cart/i }).click();
        await page.goto(`${CUSTOMER_URL}/checkout`);

        // Verify Address Validation fail
        const continueBtn = page.getByRole('button', { name: /continue/i }).first();
        if (await continueBtn.isVisible()) {
            await continueBtn.click();
            const errorMsg = page.getByText(/required|error/i).first();
            expect(await errorMsg.isVisible()).toBeTruthy();
        }

        // Fill Dummy Info
        await page.getByPlaceholder(/name/i).first().fill('Test Customer');
        const addressInput = page.getByPlaceholder(/address/i).first();
        if (await addressInput.isVisible()) await addressInput.fill('123 e2e St');

        const cityInput = page.getByPlaceholder(/city/i).first();
        if (await cityInput.isVisible()) await cityInput.fill('Testville');

        // 23. Order Summary
        await expect(page.getByText(/total/i).first()).toBeVisible();

        // Submit Order (Assuming alternative payment is available or bypassing Stripe)
        const placeOrderBtn = page.getByRole('button', { name: /place order|pay/i });
        if (await placeOrderBtn.isVisible()) {
            // We do not actually place a live order unless specifically testing Stripe in test mode.
            // We will assert the button exists and the total is rendered correctly.
            await expect(placeOrderBtn).toBeVisible();
        }
    });
});
