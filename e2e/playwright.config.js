// @ts-check
const fs = require('fs');
const path = require('path');
const { defineConfig, devices } = require('@playwright/test');

function loadDotEnv(filePath) {
    try {
        const raw = fs.readFileSync(filePath, 'utf8');
        for (const line of raw.split(/\r?\n/)) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;
            const idx = trimmed.indexOf('=');
            if (idx < 0) continue;
            const key = trimmed.slice(0, idx).trim();
            let value = trimmed.slice(idx + 1).trim();
            if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
                value = value.slice(1, -1);
            }
            if (!key) continue;
            if (process.env[key] === undefined) {
                process.env[key] = value;
            }
        }
    } catch {
        // Optional: e2e/.env may not exist in all environments.
    }
}

loadDotEnv(path.join(__dirname, '.env'));

module.exports = defineConfig({
    testDir: './tests',
    globalSetup: require.resolve('./global-setup'),
    fullyParallel: false, // Run sequentially for flow tests
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : 1, // Sequential execution for checkout -> admin flow
    // reporter: [['html', { open: 'never' }], ['list'], ['./custom-reporter.js']],
    timeout: 120_000,
    expect: {
        timeout: 15_000,
    },
    use: {
        baseURL: process.env.CUSTOMER_BASE_URL || 'https://www.aurazone.shop',
        storageState: path.join(__dirname, '.auth', 'guest.json'),
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
        video: 'retain-on-failure',
        actionTimeout: 15_000,
        navigationTimeout: 45_000,
    },
    projects: [
  {
    name: 'chrome',
    use: {
      ...devices['Desktop Chrome'],
      channel: 'chrome',
    },
  },
],
    reporter: [
    ['html', { open: 'never' }],
    ['list'],
    ['./custom-reporter.js'],
    ['@reportportal/agent-js-playwright', {
        endpoint: 'http://localhost:9090/api/v1',
        apiKey: process.env.RP_API_KEY,
        project: 'AuraZone',
        launch: 'AuraZone E2E Tests',
        description: 'Playwright automation execution',
        attributes: [
        {
            key: 'framework',
            value: 'playwright'
        },
        {
            key: 'suite',
            value: 'e2e'
        },
        {
            key: 'app',
            value: 'aurazone'
        },
        {
            key: 'team',
            value: 'qa'
        },
        {
            key: 'env',
            value: 'qa'
        }
    ]
    }]
],
});
