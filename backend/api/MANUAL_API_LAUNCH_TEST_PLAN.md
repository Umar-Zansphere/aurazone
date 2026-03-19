# Manual API Launch Test Plan (backend/api)

## Scope
- Base URL: `/api`
- Route files covered: `auth`, `admin`, `products`, `users`, `cart`, `wishlist`, `orders`, `session`, `notifications`
- Total endpoints covered: `119`
- Goal: manual pre-launch verification of all flows, auth paths, and edge cases.

## Test Data Prerequisites
- Admin account: `admin_user`
- Customer account (verified email): `cust_verified`
- Customer account (unverified email): `cust_unverified`
- Guest session id from `/api/session/create`
- Product fixtures:
  - One active product with 2 variants and stock > 10
  - One variant with low stock (<= 5)
  - One out-of-stock / unavailable variant
- At least 2 addresses for authenticated customer
- Razorpay sandbox keys configured
- VAPID keys configured

## Global Checks (apply to all endpoints)
- `G1 Happy path`: send valid request, verify status code and response schema.
- `G2 Missing auth`: protected route without token should fail (`401`).
- `G3 Invalid/expired auth`: malformed/expired token should fail (`401`).
- `G4 Role check`: admin routes with non-admin user should fail (`403`).
- `G5 Required field validation`: omit required field and verify failure.
- `G6 Invalid enum/type`: invalid status/filter/value should fail.
- `G7 Not found`: use random UUID/id and verify not-found behavior.
- `G8 Method mismatch`: wrong HTTP method should fail (`404/405`).
- `G9 Malformed JSON`: invalid JSON body should fail (`400`).
- `G10 DB side effect`: verify expected DB state changes for create/update/delete actions.

## Critical End-to-End Flows (run first)

### F1 Email Signup -> Verify -> Login -> Profile
1. `POST /api/auth/signup` with new email/password.
2. Confirm verification email link token created.
3. `GET /api/auth/verify-email?token=...`.
4. `POST /api/auth/login` with same credentials.
5. `GET /api/users/profile` with cookie token.
6. Expected: verified user can login and profile is accessible.

### F2 Forgot/Reset Password
1. `POST /api/auth/forgot-password` for existing email.
2. Extract reset token from email link.
3. `POST /api/auth/reset-password` with token + new password.
4. Login with old password should fail; new should pass.

### F3 Guest Session -> Cart/Wishlist -> Login Migration
1. `POST /api/session/create` and store `sessionId`.
2. Add guest cart items and wishlist items.
3. Login via `/api/auth/login` with `x-session-id` header.
4. Verify guest cart/wishlist moved to user account.
5. Verify guest session cookie cleared.

### F4 Customer Cart Checkout (COD)
1. Add item to cart.
2. `POST /api/orders` with `addressId` and `paymentMethod=COD`.
3. Verify order created with `status=RECEIVED`, `paymentStatus=PENDING`.
4. Verify cart items cleared.

### F5 Customer Direct Order (Buy Now, COD)
1. `POST /api/orders/direct` with `variantId`, `quantity`, `addressId`, `paymentMethod=COD`.
2. Verify order created and inventory reserved.

### F6 Guest Checkout (COD)
1. Guest cart with session.
2. `POST /api/orders` with guest `address{email,phone,...}` and `paymentMethod=COD`.
3. Verify order + tracking token returned.
4. `GET /api/orders/track/:trackingToken` should show order.

### F7 Razorpay Flow (auth + guest)
1. Create order with `paymentMethod=RAZORPAY`.
2. Verify `razorpayOrderId` returned.
3. `POST /api/orders/payment/verify` with valid signature fields.
4. Send webhook `payment.captured` to `/api/orders/webhook/razorpay`.
5. Verify order payment status becomes success and inventory sold.

### F8 Customer Order Tracking/Cancel
1. `GET /api/orders` list.
2. `GET /api/orders/:orderId` details.
3. `GET /api/orders/:orderId/track` tracking.
4. Cancel pending order with `/api/orders/:orderId/cancel`.
5. Verify cancel blocked for shipped/delivered.

### F9 Admin Order Lifecycle
1. `/api/admin/orders` list.
2. Update order status to `SHIPPED`, then `DELIVERED`.
3. Update payment status on order.
4. Create shipment + payment logs and verify in logs endpoints.
5. Soft-cancel order and verify inventory release and logs.

### F10 Admin Product/Inventory Lifecycle
1. Create product with variants and images.
2. Update product/variant.
3. Adjust inventory (`RESTOCK`, `REDUCE`, `HOLD`, `RELEASE`).
4. Verify inventory logs and low-stock behavior.

### F11 Push Notification Lifecycle
1. Fetch VAPID key.
2. Subscribe user.
3. Send admin test notification.
4. Broadcast and verify history + unread counts.
5. Mark read and mark all read.

### F12 Rate Limiting and Abuse Controls
1. Hit `/api/auth/login` > 10 times/15m from same IP.
2. Hit OTP routes > 5 times/15m.
3. Verify `429` and retry window messaging.

## Endpoint Coverage Checklist (all endpoints)

### Auth (`/api/auth`)
- [ ] `POST /signup` -> `AUTH01, AUTH02, AUTH03, G5, G9`
- [ ] `POST /login` -> `AUTH04, AUTH05, AUTH06, G9, G10`
- [ ] `GET /verify-email` -> `AUTH07, AUTH08, G5`
- [ ] `POST /forgot-password` -> `AUTH09, AUTH10`
- [ ] `POST /reset-password` -> `AUTH11, AUTH12, G5`
- [ ] `POST /change-password` -> `AUTH13, AUTH14, G2, G3`
- [ ] `POST /logout` -> `AUTH15, G2`
- [ ] `POST /resend-verification` -> `AUTH16, AUTH17`
- [ ] `POST /phone-signup` -> `AUTH18, AUTH19, G9`
- [ ] `POST /phone-signup-verify` -> `AUTH20, AUTH21`
- [ ] `POST /phone-login` -> `AUTH22, AUTH23`
- [ ] `POST /phone-login-verify` -> `AUTH24, AUTH25`
- [ ] `POST /send-phone-verification` -> `AUTH26, AUTH27, G2`
- [ ] `POST /verify-phone-otp` -> `AUTH28, AUTH29, G2`

### Session (`/api/session`)
- [ ] `POST /create` -> `SES01`
- [ ] `GET /validate` -> `SES02, SES03, G5`
- [ ] `POST /migrate` -> `SES04, SES05, SES06, G2`

### Products (`/api/products`)
- [ ] `GET /filters/options` -> `PROD01`
- [ ] `GET /popular` -> `PROD02, PROD03`
- [ ] `GET /brand/:brandName` -> `PROD04`
- [ ] `GET /category/:categoryName` -> `PROD05, PROD06`
- [ ] `GET /gender/:genderName` -> `PROD07, PROD08`
- [ ] `GET /color/:colorName` -> `PROD09`
- [ ] `GET /size/:sizeValue` -> `PROD10`
- [ ] `GET /model/:modelNumber` -> `PROD11`
- [ ] `GET /search` -> `PROD12, PROD13, PROD14`
- [ ] `GET /` -> `PROD15, PROD16`
- [ ] `GET /:productId` -> `PROD17, PROD18, G7`

### Users (`/api/users`)
- [ ] `GET /profile` -> `USR01, G2`
- [ ] `PUT /profile` -> `USR02, USR03, G2`
- [ ] `PUT /phone` -> `USR04, USR05, G2`
- [ ] `GET /addresses` -> `USR06, G2`
- [ ] `GET /addresses/:addressId` -> `USR07, G7`
- [ ] `POST /addresses` -> `USR08, USR09`
- [ ] `PUT /addresses/:addressId` -> `USR10, G7`
- [ ] `DELETE /addresses/:addressId` -> `USR11, G7`
- [ ] `PATCH /addresses/:addressId/default` -> `USR12, G7`

### Cart (`/api/cart`)
- [ ] `GET /` -> `CRT01, CRT02`
- [ ] `GET /summary` -> `CRT03`
- [ ] `POST /` -> `CRT04, CRT05, CRT06, CRT07`
- [ ] `PATCH /:cartItemId` -> `CRT08, CRT09, CRT10`
- [ ] `DELETE /:cartItemId` -> `CRT11, G7`
- [ ] `DELETE /` -> `CRT12`

### Wishlist (`/api/wishlist`)
- [ ] `GET /` -> `WIS01`
- [ ] `POST /` -> `WIS02, WIS03, WIS04`
- [ ] `DELETE /:wishlistItemId` -> `WIS05, G7`
- [ ] `POST /:wishlistItemId/move-to-cart` -> `WIS06, WIS07`
- [ ] `DELETE /` -> `WIS08`

### Orders (`/api/orders`)
- [ ] `POST /` -> `ORD01, ORD02, ORD03, ORD04, ORD05`
- [ ] `POST /direct` -> `ORD06, ORD07, ORD08`
- [ ] `GET /` -> `ORD09, G2`
- [ ] `GET /:orderId` -> `ORD10, ORD11, G2`
- [ ] `GET /track/:trackingToken` -> `ORD12, ORD13`
- [ ] `GET /:orderId/track` -> `ORD14, G2`
- [ ] `POST /:orderId/cancel` -> `ORD15, ORD16, ORD17, G2`
- [ ] `POST /payment/verify` -> `ORD18, ORD19, ORD20`
- [ ] `POST /webhook/razorpay` -> `ORD21, ORD22, ORD23`

### Notifications (`/api/notifications`)
- [ ] `GET /vapid-key` -> `NTF01, NTF02`
- [ ] `POST /subscribe` -> `NTF03, NTF04, G2`
- [ ] `DELETE /unsubscribe` -> `NTF05, G2`
- [ ] `GET /history` -> `NTF06, G4`
- [ ] `GET /unread-count` -> `NTF07, G4`
- [ ] `PATCH /:id/read` -> `NTF08, G4, G7`
- [ ] `GET /preferences` -> `NTF09, G4`
- [ ] `POST /preferences` -> `NTF10, NTF11, G4`
- [ ] `POST /test` -> `NTF12, G4`
- [ ] `POST /send` -> `NTF13, NTF14, G4`
- [ ] `POST /broadcast` -> `NTF15, NTF16, G4`

### Admin (`/api/admin`)
- [ ] `GET /dashboard` -> `ADM01, G4`
- [ ] `GET /orders` -> `ADM02, ADM03, ADM04`
- [ ] `GET /orders/logs` -> `ADM05, ADM06`
- [ ] `GET /orders/:orderId/logs` -> `ADM07, G7`
- [ ] `POST /orders/:orderId/payments` -> `ADM08, ADM09, ADM10, ADM11`
- [ ] `POST /orders/:orderId/shipments` -> `ADM12, ADM13, ADM14`
- [ ] `POST /orders/:orderId/status-email` -> `ADM15, ADM16`
- [ ] `POST /orders/:orderId/status-email/:emailLogId/resend` -> `ADM17, ADM18`
- [ ] `GET /orders/:orderId` -> `ADM19, ADM20`
- [ ] `PUT /orders/:orderId/status` -> `ADM21, ADM22, ADM23`
- [ ] `PUT /orders/:orderId/payment-status` -> `ADM24, ADM25`
- [ ] `PUT /orders/:orderId/shipment` -> `ADM26, ADM27`
- [ ] `DELETE /orders/:orderId` -> `ADM28, ADM29`
- [ ] `GET /payments` -> `ADM30, ADM31`
- [ ] `GET /payments/logs` -> `ADM32`
- [ ] `GET /payments/:paymentId/logs` -> `ADM33, G7`
- [ ] `GET /payments/:paymentId` -> `ADM34, G7`
- [ ] `PUT /payments/:paymentId` -> `ADM35, ADM36`
- [ ] `DELETE /payments/:paymentId` -> `ADM37, ADM38`
- [ ] `GET /shipments` -> `ADM39, ADM40`
- [ ] `GET /shipments/logs` -> `ADM41`
- [ ] `GET /shipments/:shipmentId/logs` -> `ADM42, G7`
- [ ] `GET /shipments/:shipmentId` -> `ADM43, G7`
- [ ] `PUT /shipments/:shipmentId` -> `ADM44, ADM45`
- [ ] `DELETE /shipments/:shipmentId` -> `ADM46, ADM47`
- [ ] `GET /products` -> `ADM48, ADM49, ADM50`
- [ ] `POST /products` -> `ADM51, ADM52, ADM53`
- [ ] `GET /products/:productId` -> `ADM54, G7`
- [ ] `PUT /products/:productId` -> `ADM55, ADM56`
- [ ] `DELETE /products/:productId` -> `ADM57, G7`
- [ ] `POST /products/:productId/variants` -> `ADM58, ADM59, ADM60`
- [ ] `PUT /variants/:variantId` -> `ADM61, ADM62`
- [ ] `DELETE /variants/:variantId` -> `ADM63, G7`
- [ ] `GET /inventory` -> `ADM64, ADM65`
- [ ] `GET /inventory/logs` -> `ADM66, ADM67`
- [ ] `GET /inventory/:variantId` -> `ADM68, G7`
- [ ] `PUT /variants/:variantId/inventory` -> `ADM69, ADM70`
- [ ] `POST /variants/:variantId/inventory/adjust` -> `ADM71, ADM72, ADM73`
- [ ] `POST /variants/:variantId/images` -> `ADM74, ADM75`
- [ ] `POST /variants/:variantId/images/copy` -> `ADM76, ADM77`
- [ ] `PUT /images/:imageId` -> `ADM78, ADM79`
- [ ] `DELETE /images/:imageId` -> `ADM80, G7`
- [ ] `GET /analytics` -> `ADM81, ADM82`
- [ ] `GET /notifications/history` -> `ADM83`
- [ ] `PUT /notifications/read-all` -> `ADM84`
- [ ] `PUT /notifications/:notificationId/read` -> `ADM85, G7`
- [ ] `POST /notifications/subscribe` -> `ADM86, ADM87`
- [ ] `DELETE /notifications/unsubscribe` -> `ADM88`
- [ ] `GET /notifications/preferences` -> `ADM89`
- [ ] `PUT /notifications/preferences` -> `ADM90, ADM91`
- [ ] `POST /notifications/broadcast` -> `ADM92, ADM93`

## Detailed Test Cases (steps)

### Auth Cases
- `AUTH01 Signup success`: POST with new email/password; expect 201 and verification email trigger.
- `AUTH02 Signup duplicate`: same email again; expect failure message.
- `AUTH03 Signup malformed`: missing email or password; expect failure.
- `AUTH04 Login success`: verified user login; accessToken cookie set.
- `AUTH05 Login wrong password`: expect failure.
- `AUTH06 Login unverified email`: expect verify-email error.
- `AUTH07 Verify email success`: valid token in query; expect success.
- `AUTH08 Verify email invalid token`: expect failure.
- `AUTH09 Forgot password existing user`: expect reset email sent.
- `AUTH10 Forgot password unknown user`: expect failure.
- `AUTH11 Reset password success`: valid token + new password.
- `AUTH12 Reset password expired/invalid token`: expect failure.
- `AUTH13 Change password success`: valid token + correct oldPassword.
- `AUTH14 Change password wrong oldPassword`: expect failure.
- `AUTH15 Logout success`: cookie cleared.
- `AUTH16 Resend verification success`: unverified email.
- `AUTH17 Resend for verified/unknown email`: expect failure.
- `AUTH18 Phone signup success`: valid phone/email/password, OTP sent.
- `AUTH19 Phone signup invalid phone`: expect 400.
- `AUTH20 Phone signup verify success`: valid OTP -> account active.
- `AUTH21 Phone signup verify invalid/expired OTP`: expect failure.
- `AUTH22 Phone login success`: registered phone receives OTP.
- `AUTH23 Phone login unregistered phone`: expect failure.
- `AUTH24 Phone login verify success`: valid OTP sets auth cookie.
- `AUTH25 Phone login verify invalid OTP`: expect failure.
- `AUTH26 Send phone verification success`: auth user + valid phone.
- `AUTH27 Send phone verification invalid phone`: expect 400.
- `AUTH28 Verify phone OTP success`: valid OTP updates phone + verified timestamp.
- `AUTH29 Verify phone OTP invalid/expired`: expect failure.

### Session Cases
- `SES01 Create session`: POST create and confirm `sessionId` + `expiresAt`.
- `SES02 Validate valid session`: supply `x-session-id`; expect valid true.
- `SES03 Validate missing/invalid`: expect 400/401.
- `SES04 Migrate session success`: authenticated user + session id moves guest artifacts.
- `SES05 Migrate unauthenticated`: expect 401.
- `SES06 Migrate missing session`: expect 400.

### Product Cases
- `PROD01 Filter options`: returns non-empty arrays for active/in-stock data.
- `PROD02 Popular default pagination`: verify `pagination` keys.
- `PROD03 Popular invalid skip/take`: ensure normalized values used.
- `PROD04 Brand search`: case-insensitive brand match.
- `PROD05 Category valid enum`: expected products.
- `PROD06 Category invalid enum`: expect 400.
- `PROD07 Gender valid enum`: expected products.
- `PROD08 Gender invalid enum`: expect 400.
- `PROD09 Color filter`: only matching variants/products.
- `PROD10 Size filter`: only matching variants/products.
- `PROD11 Model filter`: case-insensitive model number.
- `PROD12 Search by text`: terms in name/brand/description/tags.
- `PROD13 Search by combined filters`: category + price + size + color.
- `PROD14 Search invalid category/gender`: expect 400.
- `PROD15 Product list sort newest`: descending by created date.
- `PROD16 Product list invalid sort`: defaults safely.
- `PROD17 Product detail success`: includes variants/images/inventory.
- `PROD18 Product detail invalid/inactive`: expect 404.

### User Cases
- `USR01 Get profile`: authenticated user details returned.
- `USR02 Update profile name/email`: success response and updated data.
- `USR03 Update profile no fields`: expect 400.
- `USR04 Update phone success`: phone updated and verification reset.
- `USR05 Update phone duplicate/invalid`: expect failure.
- `USR06 List addresses`: returns array.
- `USR07 Get address by id`: own address success; other-user/invalid fails.
- `USR08 Create address valid`: required fields success.
- `USR09 Create address missing required`: failure.
- `USR10 Update address`: patch own address and default toggle behavior.
- `USR11 Delete address`: success and absent in list.
- `USR12 Set default address`: exactly one default address remains.

### Cart Cases
- `CRT01 Get cart (guest)`: auto-creates active cart + guest session.
- `CRT02 Get cart (auth user)`: uses user cart not guest.
- `CRT03 Cart summary`: subtotal/tax/total math correct.
- `CRT04 Add to cart success`: valid variant + qty.
- `CRT05 Add to cart max qty exceeded (>5)`: failure.
- `CRT06 Add unavailable/out-of-stock variant`: failure.
- `CRT07 Add with insufficient inventory`: failure.
- `CRT08 Update cart item quantity success`.
- `CRT09 Update quantity invalid (0/negative/non-int/>5)`: failure.
- `CRT10 Update quantity > available`: failure.
- `CRT11 Remove cart item`: success then absent.
- `CRT12 Clear cart`: items removed.

### Wishlist Cases
- `WIS01 Get wishlist`: auto-creates wishlist if absent.
- `WIS02 Add to wishlist success`.
- `WIS03 Add duplicate`: expect duplicate failure.
- `WIS04 Add invalid product/variant mismatch`: failure.
- `WIS05 Remove wishlist item`: success.
- `WIS06 Move to cart success`: wishlist item removed + cart item added.
- `WIS07 Move to cart without variant`: failure.
- `WIS08 Clear wishlist`: all items removed.

### Order Cases
- `ORD01 Create order from cart (auth + COD)`.
- `ORD02 Create order from cart (auth + RAZORPAY)` returns razorpay ids.
- `ORD03 Create order from cart guest`: requires `address.email` + `address.phone`.
- `ORD04 Create order invalid payment method`: expect failure.
- `ORD05 Create order empty cart / qty > 5`: failure.
- `ORD06 Direct order auth success`.
- `ORD07 Direct order guest success`.
- `ORD08 Direct order invalid quantity/variant`: failure.
- `ORD09 Get customer orders with pagination/status filter`.
- `ORD10 Get customer order detail own order`.
- `ORD11 Get customer order detail other user order`: unauthorized/not found.
- `ORD12 Track order by token valid`.
- `ORD13 Track order by invalid token`: not found.
- `ORD14 Track order (auth)`: shipment detail shown.
- `ORD15 Cancel pending order`: success + inventory release.
- `ORD16 Cancel delivered/shipped`: blocked.
- `ORD17 Cancel already cancelled`: blocked.
- `ORD18 Payment verify success`: valid signature + authorized/captured status.
- `ORD19 Payment verify missing params`: 400.
- `ORD20 Payment verify invalid signature`: 400.
- `ORD21 Razorpay webhook valid signature`: processed true.
- `ORD22 Razorpay webhook invalid signature`: 400.
- `ORD23 Webhook handler failure returns 200 with failure payload (no retry storm).

### Notification Cases (`/api/notifications`)
- `NTF01 VAPID key success`.
- `NTF02 VAPID key missing env`: 500.
- `NTF03 Subscribe authenticated user success`.
- `NTF04 Subscribe invalid payload`: 400.
- `NTF05 Unsubscribe success and idempotent on missing endpoint`.
- `NTF06 History admin-only returns own history`.
- `NTF07 Unread count admin-only`.
- `NTF08 Mark read only own notification`.
- `NTF09 Get preferences auto-create defaults`.
- `NTF10 Update preferences valid booleans`.
- `NTF11 Update preferences invalid value`: 400.
- `NTF12 Send test notification`.
- `NTF13 Send to user success`.
- `NTF14 Send without userId/sessionId or title/body`: 400.
- `NTF15 Broadcast success`.
- `NTF16 Broadcast missing title/body`: 400.

### Admin Cases
- `ADM01 Dashboard success metrics shape`.
- `ADM02 Orders list default`.
- `ADM03 Orders filters (status/search/includeDeleted)`.
- `ADM04 Orders invalid status`: 400.
- `ADM05 Order logs list`.
- `ADM06 Order logs filters (status/paymentStatus/date/search)`.
- `ADM07 Order logs with invalid orderId`: empty/not found semantics.
- `ADM08 Create payment for order success`.
- `ADM09 Create payment idempotency replay`: same key same payload returns existing.
- `ADM10 Create payment same key different payload`: conflict.
- `ADM11 Create payment invalid refs for RAZORPAY SUCCESS`: 400.
- `ADM12 Create shipment for order success`.
- `ADM13 Create shipment invalid status/date`: 400.
- `ADM14 Create shipment for cancelled order`: 409.
- `ADM15 Share order status email success`.
- `ADM16 Share status email with missing customer email`: logged as failed.
- `ADM17 Resend failed status email success`.
- `ADM18 Resend non-failed email`: 409.
- `ADM19 Get order by id success`.
- `ADM20 Get order by id missing/deleted (without includeDeleted)`: 404.
- `ADM21 Update order status success (including shipment sync)`.
- `ADM22 Update status to CANCELLED releases reserved inventory`.
- `ADM23 Update cancelled order status`: 409.
- `ADM24 Update order payment status success`.
- `ADM25 Update payment status for cancelled order`: 409.
- `ADM26 Update order shipment success`.
- `ADM27 Update order shipment no fields`: 400.
- `ADM28 Delete order (soft cancel) success`.
- `ADM29 Delete already cancelled order`: 409.
- `ADM30 Payments list default`.
- `ADM31 Payments filters includeDeleted/search/date/gateway/status`.
- `ADM32 Payment logs filters`.
- `ADM33 Payment logs for paymentId`.
- `ADM34 Payment detail success`.
- `ADM35 Update payment success`.
- `ADM36 Update payment invalid refs/amount`: 400.
- `ADM37 Delete payment (void) success`.
- `ADM38 Delete already voided payment`: 409.
- `ADM39 Shipments list default`.
- `ADM40 Shipments filter/search/includeDeleted`.
- `ADM41 Shipment logs filters`.
- `ADM42 Shipment logs by shipmentId`.
- `ADM43 Shipment detail success`.
- `ADM44 Update shipment status syncs order status`.
- `ADM45 Update shipment deleted/cancelled restrictions`.
- `ADM46 Delete shipment (void) success`.
- `ADM47 Delete shipment already voided`: 409.
- `ADM48 Products list default`.
- `ADM49 Products filter (category/gender/isActive/isFeatured/search)`.
- `ADM50 Products invalid sort or bool`: 400.
- `ADM51 Create product with variants success`.
- `ADM52 Create product invalid variant payload`: 400.
- `ADM53 Create product without variants`: 400.
- `ADM54 Get product by id success`.
- `ADM55 Update product success`.
- `ADM56 Update product no fields`: 400.
- `ADM57 Delete product success`.
- `ADM58 Create variant success`.
- `ADM59 Create variant invalid quantity/price`: 400.
- `ADM60 Create variant copy images from invalid source`: 404.
- `ADM61 Update variant success`.
- `ADM62 Update variant invalid types`: 400.
- `ADM63 Delete variant success`.
- `ADM64 Inventory list default`.
- `ADM65 Inventory lowStockOnly invalid bool`: 400.
- `ADM66 Inventory logs list`.
- `ADM67 Inventory logs filters/date/type`.
- `ADM68 Inventory by variant success`.
- `ADM69 Update variant inventory success`.
- `ADM70 Update variant inventory below reserved`: 400.
- `ADM71 Adjust inventory operation=SET/RESTOCK/REDUCE/HOLD/RELEASE/RETURN success`.
- `ADM72 Adjust inventory invalid operation/quantity`: 400.
- `ADM73 Adjust inventory causing reserved>quantity or negative`: 400.
- `ADM74 Create variant image success (multipart image)`.
- `ADM75 Create variant image missing file`: 400.
- `ADM76 Copy variant images success`.
- `ADM77 Copy variant images missing sourceVariantId`: 400.
- `ADM78 Update image alt/position/isPrimary success`.
- `ADM79 Update image invalid position/isPrimary`: 400.
- `ADM80 Delete image success`.
- `ADM81 Analytics period preset (`today|7d|30d|90d`)`.
- `ADM82 Analytics invalid period/date range`: 400.
- `ADM83 Admin notifications history`.
- `ADM84 Admin notifications mark read all`.
- `ADM85 Admin notifications mark read by id`.
- `ADM86 Admin notifications subscribe success`.
- `ADM87 Admin notifications subscribe invalid payload`: 400.
- `ADM88 Admin notifications unsubscribe`.
- `ADM89 Admin notifications preferences get/create`.
- `ADM90 Admin notifications preferences update success`.
- `ADM91 Admin notifications preferences invalid bool`: 400.
- `ADM92 Admin notifications broadcast success`.
- `ADM93 Admin notifications broadcast missing title/body`: 400.

## Launch Risk Notes Found from Current Code
- Many non-admin services throw plain `Error`, and global handler maps these to `500`. During manual QA, log cases where business-validation errors return `500` (likely should be `4xx`).
- `POST /api/notifications/subscribe` reads `req.cookies.sessionId`, while guest session flow primarily uses `guestSessionId`; verify guest subscription linking behavior.
- Auth login cookies are set with `secure: true`; verify behavior in non-HTTPS environments.

## Launch-Day Execution Sheet (P0/P1)

### Run Order (exact)
1. `P0-01` Auth core and account recovery
2. `P0-02` Guest session + cart/wishlist persistence
3. `P0-03` Guest -> login migration
4. `P0-04` Checkout from cart (COD)
5. `P0-05` Checkout from cart (Razorpay + verify + webhook)
6. `P0-06` Direct order (Buy Now) for auth and guest
7. `P0-07` Inventory race and stock-protection checks
8. `P0-08` Customer order lifecycle (list/detail/track/cancel rules)
9. `P0-09` Admin fulfillment lifecycle (status/payment/shipment)
10. `P0-10` Admin inventory safety operations
11. `P0-11` Public tracking token flow
12. `P0-12` Security/rate-limiting gate
13. `P1-01` Admin product/content management
14. `P1-02` Notifications lifecycle
15. `P1-03` Analytics and dashboards sanity
16. `P1-04` Logs/filter/search/soft-delete coverage

### P0 Blocks (must-pass before launch)
- `P0-01 Auth core`: signup/verify/login/logout, forgot/reset, phone OTP.
Pass: users can enter and recover account reliably; invalid OTP/token paths safe.

- `P0-02 Guest session persistence`: browsing, add/update/remove cart, return later.
Pass: no duplicate items, no cart loss, invalid/expired session handled gracefully.

- `P0-03 Guest migration`: guest cart/wishlist merged on login.
Pass: deterministic merge, quantity caps respected, no data loss.

- `P0-04 Checkout COD`: auth + guest COD orders.
Pass: valid address/payment required, order created, expected status set, cart cleanup correct.

- `P0-05 Checkout Razorpay`: order init, verify endpoint, webhook path.
Pass: signature validation works, webhook idempotent, payment/order/inventory states consistent.

- `P0-06 Direct order`: auth + guest buy-now.
Pass: variant/quantity validation strict, order created with correct totals and status.

- `P0-07 Inventory race`: concurrent purchases near stock boundary.
Pass: never oversell, never negative inventory/reserved, loser gets clear failure.

- `P0-08 Customer order lifecycle`: order list/detail/track/cancel.
Pass: only owner can access, cancel rules enforced by status.

- `P0-09 Admin fulfillment`: update order status/payment/shipment, cancel order.
Pass: state transitions valid, shipment/order sync correct, logs created.

- `P0-10 Admin inventory safety`: SET/RESTOCK/REDUCE/HOLD/RELEASE/RETURN.
Pass: no invalid reserved math, no negative values, audit logs recorded.

- `P0-11 Public tracking token`: guest tracking link.
Pass: valid token works, invalid token does not leak data.

- `P0-12 Security/rate-limit`: auth/OTP throttling + admin authorization boundaries.
Pass: rate limits enforced, non-admin blocked from admin routes.

### P1 Blocks (can run after P0 green)
- `P1-01` Admin product CRUD + variant/image management.
- `P1-02` Push notification subscribe/unsubscribe/send/broadcast/history/read states.
- `P1-03` Analytics period/date-range sanity.
- `P1-04` Logs endpoints, filters, includeDeleted behavior, search robustness.

### Go/No-Go Decision Criteria
- `GO`:
  - All `P0` blocks passed.
  - No unresolved `Sev-1` defects.
  - No unresolved payment/inventory/auth/data-loss defect.
  - No unresolved security/authorization defect.

- `CONDITIONAL GO`:
  - All `P0` passed.
  - Only `P1` defects remain and are low impact with documented workaround.

- `NO-GO`:
  - Any `P0` block failed.
  - Any defect can cause failed/duplicate payment, oversell, data loss, broken login, or privilege bypass.
  - Webhook or payment state is non-idempotent/inconsistent.

### Defect Severity Rules (for launch decision)
- `Sev-1`: payment mismatch, inventory corruption/oversell, auth bypass, admin privilege leak, order data leak.
- `Sev-2`: critical flow blocked but safe fallback exists.
- `Sev-3`: non-critical feature issue, cosmetic, or minor validation mismatch.

### Execution Log Template
- `Block ID`:
- `Owner`:
- `Start/End (UTC)`:
- `Result`: Pass/Fail
- `Defect IDs`:
- `Notes`:
- `Rerun Result`:
