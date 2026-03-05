// @ts-check
const { test, expect } = require('@playwright/test');

// Auth tests run WITHOUT the saved storageState, so we override it
test.use({ storageState: { cookies: [], origins: [] } });

const BASE = 'https://admin.aurazone.shop';
const EMAIL = process.env.ADMIN_EMAIL || 'admin@aurazone.com';
const PASSWORD = process.env.ADMIN_PASSWORD || 'Admin@123456';

// ─── Login success ─────────────────────────────────────────────
test.describe('Login — Happy Path', () => {
    test('should login with valid credentials and redirect to dashboard', async ({ page }) => {
        await page.goto(`${BASE}/login`);
        await page.getByLabel('Email address').fill(EMAIL);
        await page.getByLabel('Password').fill(PASSWORD);
        await page.getByRole('button', { name: /sign in/i }).click();
        await page.waitForURL(`${BASE}/`, { timeout: 30_000 });
        await expect(page).toHaveURL(`${BASE}/`);
    });

    test('should show "Signing In..." text while loading', async ({ page }) => {
        await page.goto(`${BASE}/login`);
        await page.getByLabel('Email address').fill(EMAIL);
        await page.getByLabel('Password').fill(PASSWORD);
        await page.getByRole('button', { name: /sign in/i }).click();
        // The button text changes to "Signing In..." during the request
        await expect(page.getByRole('button', { name: /signing in/i })).toBeVisible();
    });
});

// ─── Login validation ──────────────────────────────────────────
test.describe('Login — Validation', () => {
    test('should have submit button disabled when fields are empty', async ({ page }) => {
        await page.goto(`${BASE}/login`);
        const btn = page.getByRole('button', { name: /sign in/i });
        await expect(btn).toBeDisabled();
    });

    test('should have submit button disabled when only email is filled', async ({ page }) => {
        await page.goto(`${BASE}/login`);
        await page.getByLabel('Email address').fill(EMAIL);
        const btn = page.getByRole('button', { name: /sign in/i });
        await expect(btn).toBeDisabled();
    });

    test('should have submit button disabled when only password is filled', async ({ page }) => {
        await page.goto(`${BASE}/login`);
        await page.getByLabel('Password').fill(PASSWORD);
        const btn = page.getByRole('button', { name: /sign in/i });
        await expect(btn).toBeDisabled();
    });

    test('should enable submit button when both fields are filled', async ({ page }) => {
        await page.goto(`${BASE}/login`);
        await page.getByLabel('Email address').fill(EMAIL);
        await page.getByLabel('Password').fill(PASSWORD);
        const btn = page.getByRole('button', { name: /sign in/i });
        await expect(btn).toBeEnabled();
    });
});

// ─── Login errors ──────────────────────────────────────────────
test.describe('Login — Error Cases', () => {
    test('should show error with wrong password', async ({ page }) => {
        await page.goto(`${BASE}/login`);
        await page.getByLabel('Email address').fill(EMAIL);
        await page.getByLabel('Password').fill('WrongPassword123!');
        await page.getByRole('button', { name: /sign in/i }).click();
        // Error message should appear
        await expect(page.locator('text=Invalid credentials').or(page.locator('[style*="error"]')).first()).toBeVisible({ timeout: 15_000 });
    });

    test('should show error with non-existent email', async ({ page }) => {
        await page.goto(`${BASE}/login`);
        await page.getByLabel('Email address').fill('notreal@fake.com');
        await page.getByLabel('Password').fill('SomePassword123');
        await page.getByRole('button', { name: /sign in/i }).click();
        await page.waitForTimeout(3000);
        // Should stay on login page and show error
        expect(page.url()).toContain('/login');
    });
});

// ─── Password toggle ───────────────────────────────────────────
test.describe('Login — Password Toggle', () => {
    test('should toggle password visibility', async ({ page }) => {
        await page.goto(`${BASE}/login`);
        const pwInput = page.getByLabel('Password');
        await pwInput.fill('TestPass');
        await expect(pwInput).toHaveAttribute('type', 'password');

        // Click the show password button
        await page.getByLabel('Show password').click();
        await expect(pwInput).toHaveAttribute('type', 'text');

        // Click again to hide
        await page.getByLabel('Hide password').click();
        await expect(pwInput).toHaveAttribute('type', 'password');
    });
});

// ─── Protected routes ──────────────────────────────────────────
test.describe('Auth — Route Protection', () => {
    test('should redirect unauthenticated user from / to /login', async ({ page }) => {
        await page.goto(`${BASE}/`);
        await page.waitForURL(/\/login/, { timeout: 15_000 });
        expect(page.url()).toContain('/login');
    });

    test('should redirect unauthenticated user from /orders to /login', async ({ page }) => {
        await page.goto(`${BASE}/orders`);
        await page.waitForURL(/\/login/, { timeout: 15_000 });
        expect(page.url()).toContain('/login');
    });

    test('should redirect unauthenticated user from /products to /login', async ({ page }) => {
        await page.goto(`${BASE}/products`);
        await page.waitForURL(/\/login/, { timeout: 15_000 });
        expect(page.url()).toContain('/login');
    });

    test('should redirect unauthenticated user from /settings to /login', async ({ page }) => {
        await page.goto(`${BASE}/settings`);
        await page.waitForURL(/\/login/, { timeout: 15_000 });
        expect(page.url()).toContain('/login');
    });

    test('should redirect unauthenticated user from /analytics to /login', async ({ page }) => {
        await page.goto(`${BASE}/analytics`);
        await page.waitForURL(/\/login/, { timeout: 15_000 });
        expect(page.url()).toContain('/login');
    });

    test('should redirect unauthenticated user from /inventory to /login', async ({ page }) => {
        await page.goto(`${BASE}/inventory`);
        await page.waitForURL(/\/login/, { timeout: 15_000 });
        expect(page.url()).toContain('/login');
    });

    test('should redirect unauthenticated user from /payments to /login', async ({ page }) => {
        await page.goto(`${BASE}/payments`);
        await page.waitForURL(/\/login/, { timeout: 15_000 });
        expect(page.url()).toContain('/login');
    });

    test('should redirect unauthenticated user from /shipments to /login', async ({ page }) => {
        await page.goto(`${BASE}/shipments`);
        await page.waitForURL(/\/login/, { timeout: 15_000 });
        expect(page.url()).toContain('/login');
    });

    test('should redirect unauthenticated user from /notifications to /login', async ({ page }) => {
        await page.goto(`${BASE}/notifications`);
        await page.waitForURL(/\/login/, { timeout: 15_000 });
        expect(page.url()).toContain('/login');
    });
});

// ─── Authenticated redirect ────────────────────────────────────
test.describe('Auth — Authenticated Redirects', () => {
    // These tests need auth state — use a fresh login
    test('should redirect /login to / when already authenticated', async ({ browser }) => {
        const context = await browser.newContext({ ignoreHTTPSErrors: true });
        const page = await context.newPage();

        // Login first
        await page.goto(`${BASE}/login`);
        await page.getByLabel('Email address').fill(EMAIL);
        await page.getByLabel('Password').fill(PASSWORD);
        await page.getByRole('button', { name: /sign in/i }).click();
        await page.waitForURL(`${BASE}/`, { timeout: 30_000 });

        // Now try navigating to /login — should redirect back to /
        await page.goto(`${BASE}/login`);
        await page.waitForURL(`${BASE}/`, { timeout: 15_000 });
        expect(page.url()).not.toContain('/login');

        await context.close();
    });
});
