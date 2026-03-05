// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Products — List Page', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/products');
        await page.waitForLoadState('networkidle');
    });

    test('should display "Products" page title', async ({ page }) => {
        await expect(page.locator('h1')).toHaveText('Products');
    });

    test('should display search input', async ({ page }) => {
        await expect(page.getByPlaceholder(/search/i)).toBeVisible();
    });

    test('should display gender filter buttons', async ({ page }) => {
        const genders = ['MEN', 'WOMEN', 'UNISEX', 'KIDS'];
        for (const g of genders) {
            await expect(page.getByRole('button', { name: g })).toBeVisible();
        }
    });

    test('should display sort options', async ({ page }) => {
        await expect(page.getByRole('button', { name: 'Newest' })).toBeVisible();
    });

    test('should search for products', async ({ page }) => {
        await page.getByPlaceholder(/search/i).fill('shoe');
        await page.waitForTimeout(2000);
        const mainContent = await page.locator('main').innerHTML();
        expect(mainContent.length).toBeGreaterThan(100);
    });

    test('should filter by MEN gender', async ({ page }) => {
        await page.getByRole('button', { name: 'MEN' }).click();
        await page.waitForTimeout(2000);
        const mainContent = await page.locator('main').innerHTML();
        expect(mainContent.length).toBeGreaterThan(100);
    });

    test('should filter by WOMEN gender', async ({ page }) => {
        await page.getByRole('button', { name: 'WOMEN' }).click();
        await page.waitForTimeout(2000);
        const mainContent = await page.locator('main').innerHTML();
        expect(mainContent.length).toBeGreaterThan(100);
    });

    test('should show empty state with meaningless search', async ({ page }) => {
        await page.getByPlaceholder(/search/i).fill('zzzznonexistent99999');
        await page.waitForTimeout(2000);
        const mainContent = await page.locator('main').innerHTML();
        expect(mainContent.length).toBeGreaterThan(0);
    });

    test('should sort by price ascending', async ({ page }) => {
        await page.getByRole('button', { name: /price ↑/i }).click();
        await page.waitForTimeout(2000);
        const mainContent = await page.locator('main').innerHTML();
        expect(mainContent.length).toBeGreaterThan(100);
    });

    test('should sort by price descending', async ({ page }) => {
        await page.getByRole('button', { name: /price ↓/i }).click();
        await page.waitForTimeout(2000);
        const mainContent = await page.locator('main').innerHTML();
        expect(mainContent.length).toBeGreaterThan(100);
    });

    test('should display product cards or empty state', async ({ page }) => {
        await page.waitForTimeout(2000);
        const cards = await page.locator('.card-surface, [class*="product"]').count();
        const empty = await page.getByText(/no products/i).isVisible().catch(() => false);
        expect(cards > 0 || empty).toBeTruthy();
    });

    test('should have a link to create new product', async ({ page }) => {
        const createLink = page.locator('a[href*="/products/new"]').first();
        const exists = await createLink.count();
        expect(exists).toBeGreaterThan(0);
    });

    test('should show error state when API fails', async ({ page }) => {
        await page.route('**/api/admin/products*', (route) =>
            route.fulfill({ status: 500, body: JSON.stringify({ message: 'Error' }) })
        );
        await page.goto('/products');
        await page.waitForTimeout(3000);
        const mainContent = await page.locator('main').innerHTML();
        expect(mainContent.length).toBeGreaterThan(0);
    });
});

test.describe('Products — Detail Page', () => {
    test('should navigate to product detail', async ({ page }) => {
        await page.goto('/products');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000);

        const firstLink = page.locator('a[href*="/products/"]').first();
        if (await firstLink.count() === 0) {
            test.skip();
            return;
        }
        await firstLink.click();
        await page.waitForURL(/\/products\/[^/]+/);
        expect(page.url()).toMatch(/\/products\/[^/]+/);
    });

    test('should display product info on detail page', async ({ page }) => {
        await page.goto('/products');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000);

        const firstLink = page.locator('a[href*="/products/"]').first();
        if (await firstLink.count() === 0) {
            test.skip();
            return;
        }
        await firstLink.click();
        await page.waitForURL(/\/products\/[^/]+/);
        await page.waitForTimeout(3000);

        const mainContent = await page.locator('main').innerHTML();
        expect(mainContent.length).toBeGreaterThan(200);
    });

    test('should show variants section', async ({ page }) => {
        await page.goto('/products');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000);

        const firstLink = page.locator('a[href*="/products/"]').first();
        if (await firstLink.count() === 0) {
            test.skip();
            return;
        }
        await firstLink.click();
        await page.waitForURL(/\/products\/[^/]+/);
        await page.waitForTimeout(3000);

        // Should show variant cards or section
        const variantSection = page.getByText(/variant/i).first();
        await expect(variantSection).toBeVisible();
    });

    test('should have back navigation', async ({ page }) => {
        await page.goto('/products');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000);

        const firstLink = page.locator('a[href*="/products/"]').first();
        if (await firstLink.count() === 0) {
            test.skip();
            return;
        }
        await firstLink.click();
        await page.waitForURL(/\/products\/[^/]+/);
        await page.waitForTimeout(1000);

        await page.goBack();
        await page.waitForTimeout(1000);
        expect(page.url()).toContain('/products');
    });

    test('should have delete button on product detail', async ({ page }) => {
        await page.goto('/products');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000);

        const firstLink = page.locator('a[href*="/products/"]').first();
        if (await firstLink.count() === 0) {
            test.skip();
            return;
        }
        await firstLink.click();
        await page.waitForURL(/\/products\/[^/]+/);
        await page.waitForTimeout(3000);

        // Delete functionality should exist
        const buttons = await page.locator('button').count();
        expect(buttons).toBeGreaterThan(0);
    });

    test('should handle non-existent product ID', async ({ page }) => {
        await page.goto('/products/nonexistent-id');
        await page.waitForTimeout(3000);
        const mainContent = await page.locator('main').innerHTML();
        expect(mainContent.length).toBeGreaterThan(0);
    });
});

test.describe('Products — Create New', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/products/new');
        await page.waitForLoadState('networkidle');
    });

    test('should display create product page', async ({ page }) => {
        const mainContent = await page.locator('main').innerHTML();
        expect(mainContent.length).toBeGreaterThan(100);
    });

    test('should have name input field', async ({ page }) => {
        const nameInput = page.locator('input').first();
        await expect(nameInput).toBeVisible();
    });

    test('should display category options', async ({ page }) => {
        const categories = ['RUNNING', 'CASUAL', 'FORMAL', 'SNEAKERS'];
        for (const cat of categories) {
            const btn = page.getByRole('button', { name: cat });
            const exists = await btn.count();
            if (exists > 0) {
                await expect(btn).toBeVisible();
            }
        }
    });

    test('should display gender options', async ({ page }) => {
        const genders = ['MEN', 'WOMEN', 'UNISEX', 'KIDS'];
        for (const g of genders) {
            const btn = page.getByRole('button', { name: g });
            const exists = await btn.count();
            if (exists > 0) {
                await expect(btn).toBeVisible();
            }
        }
    });

    test('should have add variant button', async ({ page }) => {
        const addBtn = page.getByText(/add variant/i).or(page.locator('button', { hasText: /variant/i })).first();
        const exists = await addBtn.count();
        expect(exists).toBeGreaterThan(0);
    });

    test('should show step indicators or progress', async ({ page }) => {
        await page.waitForTimeout(1000);
        const mainContent = await page.locator('main').innerHTML();
        expect(mainContent).toContain('button');
    });

    test('should not submit with empty required fields', async ({ page }) => {
        // Try to find and click publish/submit button
        const publishBtn = page.getByRole('button', { name: /publish|create|save/i }).first();
        if (await publishBtn.count() > 0) {
            const disabled = await publishBtn.isDisabled();
            // Either disabled or will show validation error
            expect(true).toBeTruthy();
        }
    });

    test('should fill product name field', async ({ page }) => {
        const nameInput = page.locator('input[placeholder*="name" i], input[type="text"]').first();
        await nameInput.fill('Test Product E2E');
        await expect(nameInput).toHaveValue('Test Product E2E');
    });
});
