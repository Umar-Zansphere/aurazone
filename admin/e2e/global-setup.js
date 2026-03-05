// @ts-check
const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const AUTH_FILE = path.resolve(__dirname, '.auth/admin.json');

module.exports = async function globalSetup() {
    const authDir = path.dirname(AUTH_FILE);
    if (!fs.existsSync(authDir)) {
        fs.mkdirSync(authDir, { recursive: true });
    }

    // If fresh auth is needed, perform login via browser
    const browser = await chromium.launch();
    const context = await browser.newContext({ ignoreHTTPSErrors: true });
    const page = await context.newPage();

    await page.goto('https://admin.aurazone.shop/login', { waitUntil: 'networkidle' });

    // Fill login form
    await page.getByLabel('Email address').fill(process.env.ADMIN_EMAIL || 'admin@aurazone.com');
    await page.getByLabel('Password').fill(process.env.ADMIN_PASSWORD || 'Admin@123456');
    await page.getByRole('button', { name: /sign in/i }).click();

    // Wait for redirect to dashboard
    await page.waitForURL('https://admin.aurazone.shop/', { timeout: 30_000 });

    // Save auth state
    await context.storageState({ path: AUTH_FILE });

    await browser.close();

    console.log('✅ Global setup: Admin auth state saved.');
};
