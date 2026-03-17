const fs = require('fs');
const path = require('path');
const { request } = require('@playwright/test');

const ensureDir = (dirPath) => {
  fs.mkdirSync(dirPath, { recursive: true });
};

const isNonEmptyString = (value) => typeof value === 'string' && value.trim().length > 0;

const authDir = path.join(__dirname, '.auth');
const guestStatePath = path.join(authDir, 'guest.json');
const customerStatePath = path.join(authDir, 'customer.json');
const adminStatePath = path.join(authDir, 'admin.json');

const CUSTOMER_BASE_URL = process.env.CUSTOMER_BASE_URL || 'https://www.aurazone.shop';
const ADMIN_BASE_URL = process.env.ADMIN_BASE_URL || 'https://admin.aurazone.shop';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || '';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const CUSTOMER_EMAIL = process.env.CUSTOMER_EMAIL || '';
const CUSTOMER_PASSWORD = process.env.CUSTOMER_PASSWORD || '';

const commonHeaders = { 'ngrok-skip-browser-warning': 'true' };

async function createGuestState() {
  const api = await request.newContext({
    baseURL: CUSTOMER_BASE_URL,
    extraHTTPHeaders: commonHeaders,
  });

  try {
    await api.get('/api/cart');
    await api.storageState({ path: guestStatePath });
  } finally {
    await api.dispose();
  }
}

async function createCustomerState() {
  const api = await request.newContext({
    baseURL: CUSTOMER_BASE_URL,
    extraHTTPHeaders: commonHeaders,
  });

  try {
    if (isNonEmptyString(CUSTOMER_EMAIL) && isNonEmptyString(CUSTOMER_PASSWORD)) {
      const res = await api.post('/api/auth/login', {
        data: { email: CUSTOMER_EMAIL, password: CUSTOMER_PASSWORD },
      });
      if (!res.ok()) {
        console.warn(`global-setup: customer login failed (${res.status()}); writing unauthenticated storageState`);
      }
    }

    await api.storageState({ path: customerStatePath });
  } finally {
    await api.dispose();
  }
}

async function createAdminState() {
  const api = await request.newContext({
    baseURL: ADMIN_BASE_URL,
    extraHTTPHeaders: commonHeaders,
  });

  try {
    if (isNonEmptyString(ADMIN_EMAIL) && isNonEmptyString(ADMIN_PASSWORD)) {
      const res = await api.post('/api/auth/login', {
        data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
      });
      if (!res.ok()) {
        console.warn(`global-setup: admin login failed (${res.status()}); writing unauthenticated storageState`);
      }
    }

    await api.storageState({ path: adminStatePath });
  } finally {
    await api.dispose();
  }
}

module.exports = async () => {
  ensureDir(authDir);
  await createGuestState();
  await createCustomerState();
  await createAdminState();
};

