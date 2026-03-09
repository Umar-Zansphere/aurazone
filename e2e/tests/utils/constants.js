const CUSTOMER_BASE_URL = process.env.CUSTOMER_BASE_URL || 'https://www.aurazone.shop';
const ADMIN_BASE_URL = process.env.ADMIN_BASE_URL || 'https://admin.aurazone.shop';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@aurazone.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin@123456';

const CUSTOMER_EMAIL = process.env.CUSTOMER_EMAIL || '';
const CUSTOMER_PASSWORD = process.env.CUSTOMER_PASSWORD || '';

const TEST_DATA = {
  exactProductName: process.env.E2E_PRODUCT_EXACT || 'Urban Street',
  secondaryProductName: process.env.E2E_PRODUCT_SECONDARY || 'Forest Trek',
  tertiaryProductName: process.env.E2E_PRODUCT_TERTIARY || 'Retro Colorblock',
  category: process.env.E2E_CATEGORY || 'RUNNING',
  minPrice: Number(process.env.E2E_MIN_PRICE || 100),
  maxPrice: Number(process.env.E2E_MAX_PRICE || 125),
  variantColor: process.env.E2E_VARIANT_COLOR || 'Midnight Black',
  variantSize: process.env.E2E_VARIANT_SIZE || 'US 9',
};

const WEBHOOK_SECRET = process.env.E2E_RAZORPAY_WEBHOOK_SECRET || '';

const hasCustomerCreds = () => Boolean(CUSTOMER_EMAIL && CUSTOMER_PASSWORD);
const hasAdminCreds = () => Boolean(ADMIN_EMAIL && ADMIN_PASSWORD);
const hasWebhookSecret = () => Boolean(WEBHOOK_SECRET);

module.exports = {
  CUSTOMER_BASE_URL,
  ADMIN_BASE_URL,
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  CUSTOMER_EMAIL,
  CUSTOMER_PASSWORD,
  TEST_DATA,
  WEBHOOK_SECRET,
  hasCustomerCreds,
  hasAdminCreds,
  hasWebhookSecret,
};
