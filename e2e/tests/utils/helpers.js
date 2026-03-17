const crypto = require('crypto');
const fs = require('fs');
const { expect, request: pwRequest } = require('@playwright/test');
const {
  CUSTOMER_BASE_URL,
  ADMIN_BASE_URL,
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  CUSTOMER_EMAIL,
  CUSTOMER_PASSWORD,
  STORAGE_STATE_PATHS,
} = require('./constants');

const joinUrl = (base, path = '/') => `${base}${path.startsWith('/') ? path : `/${path}`}`;

const storageStateHasCookie = (storageStatePath, cookieName) => {
  try {
    const raw = fs.readFileSync(storageStatePath, 'utf8');
    const parsed = JSON.parse(raw);
    const cookies = Array.isArray(parsed?.cookies) ? parsed.cookies : [];
    return cookies.some((cookie) => cookie?.name === cookieName);
  } catch {
    return false;
  }
};

const parseInr = (value) => {
  const text = String(value || '');
  const match = text.match(/₹\s*([\d,]+(?:\.\d+)?)/);
  if (!match) return null;
  return Number.parseFloat(match[1].replace(/,/g, ''));
};

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function gotoCustomer(page, path = '/') {
  await page.goto(joinUrl(CUSTOMER_BASE_URL, path), { waitUntil: 'domcontentloaded' });
}

async function gotoAdmin(page, path = '/') {
  await page.goto(joinUrl(ADMIN_BASE_URL, path), { waitUntil: 'domcontentloaded' });
}

async function ensureProductsPage(page) {
  await gotoCustomer(page, '/products');
  await expect(page.getByRole('heading', { name: /products/i })).toBeVisible();
}

async function searchProducts(page, term) {
  const input = page.getByPlaceholder(/search products/i).first();
  await input.fill(term);
  await page.waitForLoadState('networkidle');
}

async function waitForToast(page, pattern) {
  const matcher = pattern instanceof RegExp ? pattern : new RegExp(pattern, 'i');
  await expect(page.locator('.toast-message').filter({ hasText: matcher }).first()).toBeVisible();
}

async function getCardPrices(page) {
  const cards = page.locator('a[href^="/product/"]');
  return cards.evaluateAll((nodes) => {
    return nodes
      .map((node) => {
        const text = node.textContent || '';
        const match = text.match(/₹\s*([\d,]+(?:\.\d+)?)/);
        if (!match) return null;
        return Number.parseFloat(match[1].replace(/,/g, ''));
      })
      .filter((num) => Number.isFinite(num));
  });
}

async function openProductByName(page, name) {
  const productLink = page.locator('a[href^="/product/"]', { hasText: name }).first();
  await expect(productLink).toBeVisible();
  await productLink.click();
  await page.waitForURL(/\/product\/[^/]+/);
}

async function addCurrentProductToCart(page) {
  const addButton = page.getByRole('button', { name: /^add to cart$/i }).first();
  const addedStateButton = page.getByRole('button', { name: /^added to cart$/i }).first();
  const successToast = page.locator('.toast-message').filter({ hasText: /added to cart/i }).first();

  await expect(addButton).toBeVisible({ timeout: 30_000 });
  await expect(addButton).toBeEnabled({ timeout: 30_000 });
  await addButton.scrollIntoViewIfNeeded();
  await addButton.click();

  // Wait for either success state or error feedback after store/API sync.
  const errorToast = page.locator('.toast-message').filter({ hasText: /insufficient|failed|error/i }).first();

  await expect
    .poll(async () => {
      if (await errorToast.isVisible().catch(() => false)) return 'error';
      if (await addedStateButton.isVisible().catch(() => false)) return 'added';
      if (await successToast.isVisible().catch(() => false)) return 'success-toast';
      return 'pending';
    }, { timeout: 45_000 })
    .not.toBe('pending');

  if (await errorToast.isVisible().catch(() => false)) {
    const message = ((await errorToast.textContent().catch(() => '')) || '').trim();
    throw new Error(`Add to cart failed${message ? `: ${message}` : ''}`);
  }

  await expect(addedStateButton).toBeVisible({ timeout: 45_000 });
  await expect(addButton).toHaveCount(0, { timeout: 45_000 });
}

async function gotoCart(page) {
  await gotoCustomer(page, '/cart');
  // Cart is a client page that fetches cart state after hydration; wait for a stable UI marker.
  await expect(
    page
      .getByRole('heading', { name: /order summary/i })
      .or(page.getByRole('heading', { name: /your cart is empty/i }))
      .first()
  ).toBeVisible();
}

async function gotoCheckout(page) {
  await gotoCustomer(page, '/checkout');
  await page.waitForLoadState('networkidle');
}

async function clearCart(page) {
  try {
    await page.request.delete(joinUrl(CUSTOMER_BASE_URL, '/api/cart'));
  } catch {
    // Best effort cleanup.
  }
}

async function fetchCart(page) {
  const res = await page.request.get(joinUrl(CUSTOMER_BASE_URL, '/api/cart'));
  expect(res.ok()).toBeTruthy();
  return res.json();
}

async function ensureCustomerLogin(page) {
  await gotoCustomer(page, '/login');

  if (!page.url().includes('/login')) {
    return;
  }

  await page.getByRole('button', { name: /email\s*&\s*password/i }).click();
  await page.locator('input[type="email"]').first().fill(CUSTOMER_EMAIL);
  await page.locator('input[type="password"]').first().fill(CUSTOMER_PASSWORD);

  await Promise.all([
    page.waitForURL((url) => !url.toString().includes('/login')),
    page.getByRole('button', { name: /^sign in$/i }).click(),
  ]);
}

async function ensureAdminLogin(page) {
  await gotoAdmin(page, '/login');

  if (!page.url().includes('/login')) {
    return;
  }

  await page.getByLabel(/email address/i).fill(ADMIN_EMAIL);
  await page.getByLabel(/^password$/i).fill(ADMIN_PASSWORD);

  await Promise.all([
    page.waitForURL((url) => !url.toString().includes('/login')),
    page.getByRole('button', { name: /sign in/i }).click(),
  ]);
}

async function ensureGuestAddressFilled(page, overrides = {}) {
  const values = {
    name: overrides.name || 'E2E Guest User',
    email: overrides.email || `e2e.guest.${Date.now()}@example.com`,
    phone: overrides.phone || '9876543210',
    addressLine1: overrides.addressLine1 || '221B Baker Street',
    addressLine2: overrides.addressLine2 || 'Near Central Park',
    city: overrides.city || 'Mumbai',
    state: overrides.state || 'Maharashtra',
    postalCode: overrides.postalCode || '400001',
  };

  await page.getByPlaceholder(/enter your full name/i).fill(values.name);
  await page.getByPlaceholder(/you@example.com/i).fill(values.email);
  await page.getByPlaceholder(/98765\s*43210/i).fill(values.phone);
  await page.getByPlaceholder(/123 main street/i).fill(values.addressLine1);
  await page.getByPlaceholder(/apartment, suite/i).fill(values.addressLine2);
  await page.getByPlaceholder(/e\.g\.,\s*mumbai/i).fill(values.city);
  await page.getByPlaceholder(/e\.g\.,\s*maharashtra/i).fill(values.state);
  await page.getByPlaceholder(/e\.g\.,\s*400001/i).fill(values.postalCode);

  return values;
}

async function createAdminApiContext(request) {
  const storageState =
    fs.existsSync(STORAGE_STATE_PATHS.admin) && storageStateHasCookie(STORAGE_STATE_PATHS.admin, 'accessToken')
      ? STORAGE_STATE_PATHS.admin
      : undefined;
  const api = await pwRequest.newContext({
    baseURL: ADMIN_BASE_URL,
    storageState,
    extraHTTPHeaders: { 'ngrok-skip-browser-warning': 'true' },
  });

  // Fallback for runs that bypass globalSetup (or first-time state generation).
  if (!storageState && ADMIN_EMAIL && ADMIN_PASSWORD) {
    const loginRes = await api.post('/api/auth/login', {
      data: {
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
      },
    });

    expect(loginRes.ok()).toBeTruthy();
    await api.storageState({ path: STORAGE_STATE_PATHS.admin });
  }

  return api;
}

async function createGuestApiContext(request, options = {}) {
  const { fresh = true } = options;
  const storageState = !fresh && fs.existsSync(STORAGE_STATE_PATHS.guest) ? STORAGE_STATE_PATHS.guest : undefined;

  const api = await pwRequest.newContext({
    baseURL: CUSTOMER_BASE_URL,
    storageState,
    extraHTTPHeaders: { 'ngrok-skip-browser-warning': 'true' },
  });

  // Ensure guestSessionId exists for APIs that require a guest session.
  await api.get('/api/cart');

  // If we expected a persisted guest state but it wasn't available, create it for later callers.
  if (!fresh && !storageState) {
    await api.storageState({ path: STORAGE_STATE_PATHS.guest });
  }

  return api;
}

async function findProductByName(apiContext, productName) {
  const response = await apiContext.get(
    joinUrl(CUSTOMER_BASE_URL, `/api/products/search?search=${encodeURIComponent(productName)}&take=20`),
    {
      headers: {
        "ngrok-skip-browser-warning": "true",
      },
    }
  );
  expect(response.ok()).toBeTruthy();
  const data = await response.json();
  const products = data?.data?.products || [];

  const exact = products.find((product) => product.name?.toLowerCase() === productName.toLowerCase());
  return exact || products[0] || null;
}

async function addVariantToCart(apiContext, variantId, quantity = 1) {
  const response = await apiContext.post(joinUrl(CUSTOMER_BASE_URL, '/api/cart'), {
      headers: {
        "ngrok-skip-browser-warning": "true",
      },
    data: { variantId, quantity },
  });
  return response;
}

async function createGuestOrder(apiContext, address, paymentMethod = 'RAZORPAY') {
  const response = await apiContext.post(joinUrl(CUSTOMER_BASE_URL, '/api/orders'), {
    headers: {
        "ngrok-skip-browser-warning": "true",
      },
    data: {
      address,
      paymentMethod,
    },
  });

  const body = await response.json().catch(() => ({}));
  return { response, body };
}

async function fetchAdminInventoryByVariant(adminApi, variantId) {
  const response = await adminApi.get(joinUrl(ADMIN_BASE_URL, `/api/admin/inventory/${variantId}`));
  expect(response.ok()).toBeTruthy();
  return response.json();
}

async function updateAdminVariant(adminApi, variantId, payload) {
  const response = await adminApi.put(joinUrl(ADMIN_BASE_URL, `/api/admin/variants/${variantId}`), {
    headers: {
        "ngrok-skip-browser-warning": "true",
      },
    data: payload,
  });
  expect(response.ok()).toBeTruthy();
  return response.json();
}

async function updateAdminInventory(adminApi, variantId, quantity, note = 'E2E stock update') {
  const response = await adminApi.put(joinUrl(ADMIN_BASE_URL, `/api/admin/variants/${variantId}/inventory`), {
    headers: {
        credentials: "include",
        "ngrok-skip-browser-warning": "true",
      },
    data: { quantity, note },
  });
  expect(response.ok()).toBeTruthy();
  return response.json();
}

async function updateAdminProduct(adminApi, productId, payload) {
  const response = await adminApi.put(joinUrl(ADMIN_BASE_URL, `/api/admin/products/${productId}`), {
    headers: {
        credentials: "include",
        "ngrok-skip-browser-warning": "true",
      },
    data: payload,
  });
  expect(response.ok()).toBeTruthy();
  return response.json();
}

async function ensureCustomerAddress(page) {
  const listRes = await page.request.get(joinUrl(CUSTOMER_BASE_URL, '/api/users/addresses'));
  if (!listRes.ok()) {
    throw new Error('Unable to fetch customer addresses. Ensure CUSTOMER_EMAIL/CUSTOMER_PASSWORD are valid.');
  }

  const raw = await listRes.json();
  const addresses = Array.isArray(raw) ? raw : (raw?.data || []);
  if (addresses.length > 0) {
    return addresses[0];
  }

  const createRes = await page.request.post(joinUrl(CUSTOMER_BASE_URL, '/api/users/addresses'), {
    data: {
      name: 'E2E Home',
      phone: '9876543210',
      addressLine1: '42 QA Street',
      addressLine2: 'Suite 7',
      city: 'Bengaluru',
      state: 'Karnataka',
      postalCode: '560001',
      country: 'India',
      isDefault: true,
    },
  });

  expect(createRes.ok()).toBeTruthy();
  const created = await createRes.json();
  return created?.address || created?.data?.address || created?.data || null;
}

function signRazorpayWebhook(payload, secret) {
  const raw = JSON.stringify(payload);
  const signature = crypto
    .createHmac('sha256', secret)
    .update(raw)
    .digest('hex');

  return { raw, signature };
}

async function forceRazorpayMock(page, mode = 'success') {
  await page.addInitScript((currentMode) => {
    // eslint-disable-next-line no-undef
    window.Razorpay = function MockRazorpay(options) {
      this.open = function open() {
        if (currentMode === 'dismiss') {
          options?.modal?.ondismiss?.();
          return;
        }

        if (currentMode === 'decline') {
          options?.handler?.({
            razorpay_order_id: options.order_id,
            razorpay_payment_id: `pay_declined_${Date.now()}`,
            razorpay_signature: 'invalid_signature',
          });
          return;
        }

        options?.handler?.({
          razorpay_order_id: options.order_id,
          razorpay_payment_id: `pay_success_${Date.now()}`,
          razorpay_signature: 'valid_signature',
        });
      };
    };
  }, mode);
}

module.exports = {
  ADMIN_BASE_URL,
  CUSTOMER_BASE_URL,
  parseInr,
  delay,
  gotoCustomer,
  gotoAdmin,
  ensureProductsPage,
  searchProducts,
  waitForToast,
  getCardPrices,
  openProductByName,
  addCurrentProductToCart,
  gotoCart,
  gotoCheckout,
  clearCart,
  fetchCart,
  ensureCustomerLogin,
  ensureAdminLogin,
  ensureGuestAddressFilled,
  createAdminApiContext,
  createGuestApiContext,
  findProductByName,
  addVariantToCart,
  createGuestOrder,
  fetchAdminInventoryByVariant,
  updateAdminVariant,
  updateAdminInventory,
  updateAdminProduct,
  ensureCustomerAddress,
  signRazorpayWebhook,
  forceRazorpayMock,
};
