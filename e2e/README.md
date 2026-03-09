# AuraZone E2E Playwright Suite

This suite covers the customer + admin end-to-end scenarios requested across:

- `tests/01-product-search-and-browsing.spec.js`
- `tests/02-cart-management.spec.js`
- `tests/03-checkout-and-order-placement.spec.js`
- `tests/04-payment-processing.spec.js`
- `tests/05-order-tracking-dashboard.spec.js`
- `tests/06-admin-reflection.spec.js`
- `tests/07-concurrency-edge-cases.spec.js`

## Run

```bash
cd e2e
npm test
```

## Environment Variables

Optional base URLs:

- `CUSTOMER_BASE_URL` (default: `https://www.aurazone.shop`)
- `ADMIN_BASE_URL` (default: `https://admin.aurazone.shop`)

Auth credentials:

- `ADMIN_EMAIL` (default: `admin@aurazone.com`)
- `ADMIN_PASSWORD` (default: `Admin@123456`)
- `CUSTOMER_EMAIL` (required for authenticated customer scenarios)
- `CUSTOMER_PASSWORD` (required for authenticated customer scenarios)

Test data overrides:

- `E2E_PRODUCT_EXACT`
- `E2E_PRODUCT_SECONDARY`
- `E2E_PRODUCT_TERTIARY`
- `E2E_CATEGORY`
- `E2E_MIN_PRICE`
- `E2E_MAX_PRICE`
- `E2E_VARIANT_COLOR`
- `E2E_VARIANT_SIZE`

Webhook validation tests:

- `E2E_RAZORPAY_WEBHOOK_SECRET` (required for real webhook signature validation tests)

## Notes

- Admin mutation tests restore inventory/price/product flags in cleanup blocks.
- Scenarios requiring unavailable features (e.g., COD toggle off) are skipped at runtime.
- Tests intentionally surface real behavioral gaps if the live site does not match expected scenario outcomes.
