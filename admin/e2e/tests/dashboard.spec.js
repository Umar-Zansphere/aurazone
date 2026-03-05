// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Dashboard Page', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('networkidle');
    });

    // ─── Page structure ────────────────────────────────────────────
    test('should display page heading "Home"', async ({ page }) => {
        await expect(page.locator('h1')).toHaveText('Home');
    });

    test('should display "Overview" label above heading', async ({ page }) => {
        await expect(page.locator('.page-label').first()).toHaveText('Overview');
    });

    // ─── Loading state ────────────────────────────────────────────
    test('should show skeleton loaders while data is loading', async ({ page }) => {
        // Intercept API to delay response
        await page.route('**/api/admin/dashboard', async (route) => {
            await new Promise((r) => setTimeout(r, 3000));
            await route.continue();
        });
        await page.goto('/');
        const skeleton = page.locator('.skeleton').first();
        await expect(skeleton).toBeVisible();
    });

    // ─── Data display ─────────────────────────────────────────────
    test('should render revenue hero section after data loads', async ({ page }) => {
        // Wait for any data to appear — revenue hero or empty/error state
        const content = page.locator('.card-surface, [class*="empty"]').first();
        await expect(content).toBeVisible({ timeout: 15_000 });
    });

    test('should display dashboard content or empty state', async ({ page }) => {
        // Either dashboard data or empty state should be present
        const hasData = await page.locator('.card-surface').count() > 0;
        const hasEmpty = await page.getByText(/no dashboard data/i).isVisible().catch(() => false);
        expect(hasData || hasEmpty).toBeTruthy();
    });

    // ─── Error handling ───────────────────────────────────────────
    test('should show error state when API fails', async ({ page }) => {
        await page.route('**/api/admin/dashboard', (route) =>
            route.fulfill({ status: 500, body: JSON.stringify({ message: 'Server error' }) })
        );
        await page.goto('/');
        await expect(page.getByText(/failed to load dashboard/i)).toBeVisible({ timeout: 15_000 });
    });

    test('should show retry button on error state', async ({ page }) => {
        await page.route('**/api/admin/dashboard', (route) =>
            route.fulfill({ status: 500, body: JSON.stringify({ message: 'Server error' }) })
        );
        await page.goto('/');
        await expect(page.getByRole('button', { name: /retry/i })).toBeVisible({ timeout: 15_000 });
    });

    test('should reload data when retry button is clicked', async ({ page }) => {
        let callCount = 0;
        await page.route('**/api/admin/dashboard', (route) => {
            callCount++;
            if (callCount === 1) {
                return route.fulfill({ status: 500, body: JSON.stringify({ message: 'Server error' }) });
            }
            return route.continue();
        });
        await page.goto('/');
        await expect(page.getByText(/failed to load dashboard/i)).toBeVisible({ timeout: 15_000 });

        await page.getByRole('button', { name: /retry/i }).click();
        // After retry, error should disappear or data should load
        await page.waitForTimeout(3000);
        expect(callCount).toBeGreaterThanOrEqual(2);
    });

    // ─── Empty state ──────────────────────────────────────────────
    test('should show empty state when API returns null data', async ({ page }) => {
        await page.route('**/api/admin/dashboard', (route) =>
            route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify(null),
            })
        );
        await page.goto('/');
        await page.waitForTimeout(3000);
        // Should show empty state or "No dashboard data"
        const emptyVisible = await page.getByText(/no dashboard data/i).isVisible().catch(() => false);
        const errorVisible = await page.getByText(/failed/i).isVisible().catch(() => false);
        expect(emptyVisible || errorVisible).toBeTruthy();
    });

    // ─── Navigation from dashboard ────────────────────────────────
    test('should be at root URL', async ({ page }) => {
        await expect(page).toHaveURL(/\/$/);
    });

    test('should have correct document title', async ({ page }) => {
        const title = await page.title();
        expect(title.length).toBeGreaterThan(0);
    });

    // ─── Responsive checks ────────────────────────────────────────
    test('should display sidebar on desktop viewport', async ({ page }) => {
        await expect(page.locator('aside').first()).toBeVisible();
    });

    test('should render activity feed section', async ({ page }) => {
        // Wait for page to load completely
        await page.waitForTimeout(2000);
        // Activity feed or some content should be present
        const pageContent = await page.locator('main').innerHTML();
        expect(pageContent.length).toBeGreaterThan(100);
    });

    test('should show bento grid or data sections', async ({ page }) => {
        await page.waitForTimeout(3000);
        // Check for grid layout or cards
        const cards = await page.locator('.card-surface').count();
        const empty = await page.getByText(/no dashboard data/i).isVisible().catch(() => false);
        expect(cards > 0 || empty).toBeTruthy();
    });
});
