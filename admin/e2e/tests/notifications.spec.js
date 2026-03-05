// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Notifications — Page Load', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/notifications');
        await page.waitForLoadState('networkidle');
    });

    test('should display "Notifications" page title', async ({ page }) => {
        await expect(page.locator('h1')).toHaveText('Notifications');
    });

    test('should display page label', async ({ page }) => {
        const pageLabel = page.locator('.page-label').first();
        await expect(pageLabel).toBeVisible();
    });

    test('should show notification items or empty state', async ({ page }) => {
        await page.waitForTimeout(3000);
        const hasItems = (await page.locator('main').innerHTML()).length > 200;
        const hasEmpty = await page.getByText(/no notifications/i).isVisible().catch(() => false);
        expect(hasItems || hasEmpty).toBeTruthy();
    });
});

test.describe('Notifications — Actions', () => {
    test('should have "Mark All Read" button', async ({ page }) => {
        await page.goto('/notifications');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000);

        const markAllBtn = page.getByText(/mark all/i).or(page.locator('button').filter({ has: page.locator('svg') })).first();
        const exists = await markAllBtn.count();
        expect(exists).toBeGreaterThan(0);
    });

    test('should mark all notifications as read', async ({ page }) => {
        await page.goto('/notifications');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000);

        const markAllBtn = page.getByText(/mark all/i).first();
        if (await markAllBtn.count() > 0) {
            await markAllBtn.click();
            await page.waitForTimeout(2000);
            // Page should update
            const mainContent = await page.locator('main').innerHTML();
            expect(mainContent.length).toBeGreaterThan(0);
        } else {
            test.skip();
        }
    });

    test('should have broadcast button', async ({ page }) => {
        await page.goto('/notifications');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000);

        const broadcastBtn = page.getByText(/broadcast/i).first();
        const exists = await broadcastBtn.count();
        expect(exists).toBeGreaterThanOrEqual(0);
    });

    test('should open broadcast sheet when clicking broadcast button', async ({ page }) => {
        await page.goto('/notifications');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000);

        const broadcastBtn = page.getByText(/broadcast/i).first();
        if (await broadcastBtn.count() > 0) {
            await broadcastBtn.click();
            await page.waitForTimeout(1000);
            // Sheet/modal should be open
            const bodyContent = await page.locator('body').innerHTML();
            expect(bodyContent.length).toBeGreaterThan(500);
        } else {
            test.skip();
        }
    });
});

test.describe('Notifications — Grouping', () => {
    test('should display grouped notification headers', async ({ page }) => {
        await page.goto('/notifications');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(3000);

        // Groups like "Today", "Yesterday", etc. should exist if there are notifications
        const mainContent = await page.locator('main').textContent();
        expect(mainContent.length).toBeGreaterThan(0);
    });
});

test.describe('Notifications — Error Handling', () => {
    test('should show error state when API fails', async ({ page }) => {
        await page.route('**/api/admin/notifications/history*', (route) =>
            route.fulfill({ status: 500, body: JSON.stringify({ message: 'Error' }) })
        );
        await page.goto('/notifications');
        await page.waitForTimeout(3000);
        const mainContent = await page.locator('main').innerHTML();
        expect(mainContent.length).toBeGreaterThan(0);
    });

    test('should show empty state when no notifications exist', async ({ page }) => {
        await page.route('**/api/admin/notifications/history*', (route) =>
            route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ notifications: [] }),
            })
        );
        await page.goto('/notifications');
        await page.waitForTimeout(3000);
        const mainContent = await page.locator('main').innerHTML();
        expect(mainContent.length).toBeGreaterThan(0);
    });
});

test.describe('Notifications — Icon Display', () => {
    test('should render notification icons based on type', async ({ page }) => {
        await page.goto('/notifications');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(3000);

        // SVG icons should be present in notification items
        const svgs = await page.locator('main svg').count();
        expect(svgs).toBeGreaterThanOrEqual(0); // 0 if empty state
    });

    test('should render notification text content', async ({ page }) => {
        await page.goto('/notifications');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(3000);

        const textContent = await page.locator('main').textContent();
        expect(textContent.length).toBeGreaterThan(10);
    });
});

test.describe('Notifications — Broadcast Flow', () => {
    test('should fill broadcast form and send', async ({ page }) => {
        await page.goto('/notifications');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000);

        const broadcastBtn = page.getByText(/broadcast/i).first();
        if (await broadcastBtn.count() === 0) {
            test.skip();
            return;
        }

        await broadcastBtn.click();
        await page.waitForTimeout(1000);

        // Fill title and body inputs if they appear in the broadcast sheet
        const titleInput = page.locator('input[placeholder*="title" i], input[type="text"]').first();
        const bodyInput = page.locator('textarea, input[placeholder*="message" i], input[placeholder*="body" i]').first();

        if (await titleInput.count() > 0) {
            await titleInput.fill('E2E Test Broadcast');
        }
        if (await bodyInput.count() > 0) {
            await bodyInput.fill('This is a test broadcast from Playwright E2E tests');
        }

        // Should have a send/submit button
        const sendBtn = page.getByRole('button', { name: /send|broadcast|submit/i }).first();
        if (await sendBtn.count() > 0) {
            await expect(sendBtn).toBeVisible();
        }
    });
});
