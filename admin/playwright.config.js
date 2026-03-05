// @ts-check
const { defineConfig, devices } = require('@playwright/test');
const path = require('path');

require('dotenv').config({ path: path.resolve(__dirname, 'e2e/.env') });

module.exports = defineConfig({
    testDir: './e2e/tests',
    fullyParallel: false,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: 1,
    reporter: [['html', { open: 'never' }], ['list']],
    timeout: 60_000,
    expect: { timeout: 10_000 },

    use: {
        baseURL: 'https://admin.aurazone.shop',
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
        video: 'retain-on-failure',
        actionTimeout: 15_000,
        navigationTimeout: 30_000,
    },

    globalSetup: './e2e/global-setup.js',

    projects: [
        {
            name: 'chromium-desktop',
            use: {
                ...devices['Desktop Chrome'],
                storageState: './e2e/.auth/admin.json',
                viewport: { width: 1440, height: 900 },
            },
        },
    ],
});
