const path = require('path');

const CUSTOMER_BASE_URL = process.env.CUSTOMER_BASE_URL || 'https://www.aurazone.shop';
const ADMIN_BASE_URL = process.env.ADMIN_BASE_URL || 'https://admin.aurazone.shop';

// Intentionally blank by default so stock-mutation scenarios don't run against shared environments
// unless credentials are explicitly provided.
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || '';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';

const CUSTOMER_EMAIL = process.env.CUSTOMER_EMAIL || '';
const CUSTOMER_PASSWORD = process.env.CUSTOMER_PASSWORD || '';

const BASE_TEST_DATA = {
  exactProductName: process.env.E2E_PRODUCT_EXACT || 'Urban Street',
  secondaryProductName: process.env.E2E_PRODUCT_SECONDARY || 'Forest Trek',
  tertiaryProductName: process.env.E2E_PRODUCT_TERTIARY || 'Retro Colorblock',
  category: process.env.E2E_CATEGORY || 'RUNNING',
  minPrice: Number(process.env.E2E_MIN_PRICE || 100),
  maxPrice: Number(process.env.E2E_MAX_PRICE || 125),
  variantColor: process.env.E2E_VARIANT_COLOR || 'Midnight Black',
  variantSize: process.env.E2E_VARIANT_SIZE || 'US 9',
};

const SUITE_TEST_DATA_OVERRIDES = {
  cart: {
    exactProductName: process.env.E2E_CART_PRODUCT_EXACT || 'Cart Anchor',
    secondaryProductName: process.env.E2E_CART_PRODUCT_SECONDARY || 'Cart Relay',
    tertiaryProductName: process.env.E2E_CART_PRODUCT_TERTIARY || BASE_TEST_DATA.tertiaryProductName,
    variantColor: process.env.E2E_CART_VARIANT_COLOR || 'Midnight Black',
    variantSize: process.env.E2E_CART_VARIANT_SIZE || 'US 9',
  },
  concurrency: {
    exactProductName: process.env.E2E_CONCURRENCY_PRODUCT_EXACT || 'Concurrency Bolt',
    secondaryProductName: process.env.E2E_CONCURRENCY_PRODUCT_SECONDARY || 'Concurrency Guard',
    tertiaryProductName: process.env.E2E_CONCURRENCY_PRODUCT_TERTIARY || 'Concurrency Pulse',
  },
};

function getTestData(suite = 'default') {
  if (!suite || suite === 'default') return { ...BASE_TEST_DATA };
  return {
    ...BASE_TEST_DATA,
    ...(SUITE_TEST_DATA_OVERRIDES[suite] || {}),
  };
}

const TEST_DATA = getTestData('default');

const WEBHOOK_SECRET = process.env.E2E_RAZORPAY_WEBHOOK_SECRET || process.env.WEBHOOK_SECRET || '';

const hasCustomerCreds = () => Boolean(CUSTOMER_EMAIL && CUSTOMER_PASSWORD);
const hasAdminCreds = () => Boolean(ADMIN_EMAIL && ADMIN_PASSWORD);
const hasWebhookSecret = () => Boolean(WEBHOOK_SECRET);

const E2E_ROOT = path.join(__dirname, '..', '..');
const AUTH_DIR = path.join(E2E_ROOT, '.auth');
const STORAGE_STATE_PATHS = {
  guest: path.join(AUTH_DIR, 'guest.json'),
  customer: path.join(AUTH_DIR, 'customer.json'),
  admin: path.join(AUTH_DIR, 'admin.json'),
};

module.exports = {
  CUSTOMER_BASE_URL,
  ADMIN_BASE_URL,
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  CUSTOMER_EMAIL,
  CUSTOMER_PASSWORD,
  TEST_DATA,
  getTestData,
  WEBHOOK_SECRET,
  hasCustomerCreds,
  hasAdminCreds,
  hasWebhookSecret,
  STORAGE_STATE_PATHS,
};
