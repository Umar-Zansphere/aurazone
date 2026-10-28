# AuraZone — Production-Ready Knowledge Transfer (KT) & Engineering Handoff

Welcome to the **AuraZone** engineering repository. This document serves as the comprehensive, production-grade Knowledge Transfer (KT) handoff guide for software engineers, engineering leads, QA automation engineers, and DevOps specialists taking ownership of the AuraZone platform.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Technology Stack](#2-technology-stack)
3. [Architecture Overview](#3-architecture-overview)
4. [Repository Structure](#4-repository-structure)
5. [Prerequisites](#5-prerequisites)
6. [Installation and Local Setup](#6-installation-and-local-setup)
7. [Environment Configuration](#7-environment-configuration)
8. [Running the Application](#8-running-the-application)
9. [Application Workflows](#9-application-workflows)
10. [API Documentation](#10-api-documentation)
11. [Database and Data Management](#11-database-and-data-management)
12. [Authentication and Authorization](#12-authentication-and-authorization)
13. [Testing and Quality Checks](#13-testing-and-quality-checks)
14. [Build and Deployment](#14-build-and-deployment)
15. [Logging, Monitoring, and Troubleshooting](#15-logging-monitoring-and-troubleshooting)
16. [Known Issues and Technical Debt](#16-known-issues-and-technical-debt)
17. [Code Maintenance Guidelines](#17-code-maintenance-guidelines)
18. [KT Handoff Checklist](#18-kt-handoff-checklist)
19. [Useful References](#19-useful-references)

---

## 1. Project Overview

**AuraZone** is a full-stack, multi-tier e-commerce platform specializing in athletic and lifestyle footwear (Running, Casual, Formal, and Sneakers across Men, Women, Unisex, and Kids).

### Key Functional Capabilities

*   **Customer Storefront (`customer/`)**:
    *   Catalog discovery: Filter by category, gender, color, size, and price range.
    *   Shopping Cart & Wishlist: Real-time cart state, guest persistence, and one-click "Buy Now" flow.
    *   Guest-to-User Session Migration: Carts and wishlists initiated by unauthenticated users are automatically merged into their account upon sign-up or login.
    *   Multi-channel Checkout: Support for Cash on Delivery (COD) and Razorpay online gateway.
    *   Order Tracking & Management: Self-service tracking via public tracking token (`/track-order/:token`) or authenticated user profile.
    *   Push Notifications: Web Push integration for order updates and promotions.
*   **Admin Dashboard (`admin/`)**:
    *   Catalog Operations: CRUD product catalog, multi-variant matrix (size/color/SKU/pricing), primary image assignment, and bulk product import via Excel/CSV (`.xlsx`, `.csv`).
    *   Inventory Management: Stock level tracking, manual adjustments (`RESTOCK`, `REDUCE`), hold reservations, low-stock alerts, and full inventory ledger logs.
    *   Order Fulfillment: Order processing lifecycle (`RECEIVED` &rarr; `SHIPPED` &rarr; `DELIVERED` &rarr; `CANCELLED`), tracking number and courier assignment.
    *   Payment & Shipment Auditing: Immutable ledger tracking payment transitions and courier status changes.
    *   AI Content Generation: Automated product titles, descriptions, and SEO tags via OpenRouter AI (`gpt-4o-mini`).
    *   Analytics Dashboard: Revenue, order volume, average order value (AOV), and category sales charts.
*   **Test Automation & CI/CD**:
    *   End-to-End Playwright Suite (`e2e/`): 7 end-to-end customer and admin test scenarios.
    *   End-to-End Selenium Suite (`selenium/`): Cross-browser Python Pytest automation suite.
    *   Automated CI Pipeline (`Jenkinsfile`): Scheduled nightly regression runs with HTML reports and email alerts.

---

## 2. Technology Stack

### Backend (`backend/`)
*   **Runtime**: Node.js (v20+ LTS recommended, verified on v24)
*   **Framework**: Express.js 5.2.1
*   **Database & ORM**: PostgreSQL via Prisma ORM 7.4.1 (`@prisma/client`, `@prisma/adapter-pg`, and `pg` connection pool)
*   **Security & Auth**: JWT (`jsonwebtoken` 9.0.3), password hashing (`bcryptjs` 3.0.3), cookie parser (`cookie-parser` 1.4.7), rate limiting (`express-rate-limit` 8.2.1)
*   **Payment Processing**: Razorpay Node SDK (2.9.6) with HMAC-SHA256 webhook signature validation
*   **Media & Storage**: AWS S3 SDK (`@aws-sdk/client-s3` 3.995.0), Multer (`multer` 2.0.2, `multer-s3` 3.0.1), image validation & optimization (`sharp` 0.34.5, `image-size` 2.0.2)
*   **Email Services**: Resend (6.9.2) with EJS templating (`ejs` 4.0.1)
*   **Web Push**: `web-push` 3.6.7 (VAPID protocol)
*   **Integration Testing**: Jest 30.4.2, Supertest 7.2.2

### Customer Storefront (`customer/`)
*   **Framework**: Next.js 16.1.6 (App Router)
*   **UI Library**: React 19.2.3, React DOM 19.2.3
*   **Styling**: Tailwind CSS v4 (`@tailwindcss/postcss`, `tailwind-merge`, `clsx`)
*   **State Management**: Zustand 5.0.11
*   **Icons**: Lucide React 0.575.0
*   **Testing**: Jest 30.4.2, React Testing Library 16.3.2, `@swc/jest`

### Admin Dashboard (`admin/`)
*   **Framework**: Next.js 16.1.6 (App Router) with PWA support (`next-pwa` 5.6.0)
*   **UI Library**: React 19.2.3, Framer Motion 12.23.24
*   **Styling**: Tailwind CSS v4
*   **Data Visualization**: Recharts 3.3.0
*   **Data Processing**: SheetJS (`xlsx` 0.18.5) for spreadsheet imports
*   **Edge Authentication**: `jose` 6.1.2 (for Next.js Edge middleware token verification)
*   **State Management**: Zustand 5.0.8
*   **Testing**: Jest 30.2.0, React Testing Library 16.3.2, Playwright 1.58.2

### Automation Suites
*   **E2E (Playwright)**: `@playwright/test` 1.58.2, ReportPortal agent (`@reportportal/agent-js-playwright`)
*   **E2E (Selenium)**: Python 3.10+, Selenium 4.27.1, Pytest 8.3.4, WebDriver Manager 4.0.2

---

## 3. Architecture Overview

### High-Level System Architecture

```mermaid
graph TD
    subgraph Clients
        CustomerApp["Customer Storefront<br/>Next.js 16 (Port 3000)"]
        AdminApp["Admin Dashboard<br/>Next.js 16 (Port 3001)"]
    end

    subgraph ReverseProxy["Next.js Route Rewrites (/api/*)"]
        CustRewrite["customer/next.config.mjs"]
        AdminRewrite["admin/next.config.mjs"]
    end

    subgraph BackendServices["Express 5.2 Backend (Port 5000)"]
        App["Express App (app.js)"]
        AuthMiddleware["Auth & Session Middleware"]
        RouteHandlers["API Routes (/api/*)"]
        PrismaClient["Prisma ORM Client 7.4"]
    end

    subgraph Infrastructure
        Postgres[(PostgreSQL 14+)]
        S3Bucket[("AWS S3 Media Bucket")]
        RazorpayGateway["Razorpay Payments & Webhooks"]
        ResendEmail["Resend Email API"]
        OpenRouterAI["OpenRouter AI (gpt-4o-mini)"]
    end

    CustomerApp --> CustRewrite
    AdminApp --> AdminRewrite
    CustRewrite -->|Proxy Requests| App
    AdminRewrite -->|Proxy Requests| App

    App --> AuthMiddleware
    AuthMiddleware --> RouteHandlers
    RouteHandlers --> PrismaClient
    PrismaClient --> Postgres

    RouteHandlers -->|Image Uploads| S3Bucket
    RouteHandlers -->|Payment Verification| RazorpayGateway
    RouteHandlers -->|Transactional Mail| ResendEmail
    AdminApp -->|Product Copy Gen| OpenRouterAI
```

### Component Roles & Responsibilities

1.  **Frontend Rewrites**: Both frontends use Next.js `rewrites` to route `/api/:path*` directly to the Express backend (`NEXT_PUBLIC_API_URL/api/:path*`). This avoids cross-origin domain mismatches in local development and standardizes API calls.
2.  **Stateless & Cookie-Driven Auth**: Access tokens are signed JWTs stored in HTTP-only, secure cookies. The Next.js Admin middleware verifies the token using the lightweight `jose` library on edge runtimes without hitting the database on every page navigation.
3.  **Guest & User Session Dualism**: Unauthenticated visitors are assigned a UUID `guestSessionId`. Their carts, wishlists, and OTP requests are tied to this session. Upon login, an atomic database transaction reassigns all records to the authenticated user's ID.
4.  **Resilient Order Lifecycle**: Orders are governed by transactional inventory holds. Stock is reserved upon order placement and committed upon payment confirmation.

---

## 4. Repository Structure

```
aurazone/
├── backend/                        # Node.js + Express 5 + Prisma API
│   ├── api/
│   │   ├── controllers/            # Route controllers (admin, auth, cart, orders, etc.)
│   │   ├── middleware/             # auth.middleware.js, admin.middleware.js
│   │   ├── routes/                 # Express route definitions
│   │   ├── services/               # Core business logic (order, razorpay, admin, s3, etc.)
│   │   ├── utils/                  # admin.utils.js helper functions
│   │   └── MANUAL_API_LAUNCH_TEST_PLAN.md # 119-endpoint comprehensive test specification
│   ├── config/                     # Prisma client pool and Resend email configuration
│   ├── emails/                     # EJS templates for transactional notifications
│   ├── prisma/                     # Database schema, migrations, seed scripts
│   │   ├── schema.prisma           # Complete Prisma schema definition
│   │   ├── seed.js                 # Database seeder (admin, user, sample catalog)
│   │   └── seed-admin.js           # Standalone admin user creation script
│   ├── utils/                      # catchAsync.js, error.js, imageProcessor.js
│   ├── .env.example                # Backend environment variable template
│   ├── app.js                      # Express application setup, CORS, error handling
│   ├── server.js                   # Application entry point (listen on PORT)
│   └── package.json
├── admin/                          # Next.js 16 Admin Dashboard
│   ├── src/
│   │   ├── app/
│   │   │   ├── (app)/              # Authenticated pages (orders, products, inventory, analytics)
│   │   │   ├── (auth)/             # Login page
│   │   │   └── api/ai/             # OpenRouter AI product copy generator API route
│   │   ├── components/             # Admin UI components, layout, modals, tables
│   │   ├── hooks/                  # Custom React hooks (debounce, keyboard, etc.)
│   │   ├── lib/                    # apiFetch client, formatters, animation helpers
│   │   ├── stores/                 # Zustand state stores (notifications, etc.)
│   │   └── middleware.js           # Route protection and role verification (jose JWT)
│   ├── .env.example                # Admin environment variable template
│   ├── next.config.mjs             # Next.js config with PWA and backend API rewrites
│   └── package.json
├── customer/                       # Next.js 16 Customer Storefront
│   ├── src/
│   │   ├── app/
│   │   │   ├── (auth)/             # Authentication routes (login, signup, OTP, reset)
│   │   │   ├── cart/               # Cart page
│   │   │   ├── checkout/           # Multi-step checkout with COD & Razorpay
│   │   │   ├── order-confirmation/ # Order status confirmation screen
│   │   │   ├── orders/             # Customer order history and details
│   │   │   ├── track-order/        # Public order tracking by tracking token
│   │   │   ├── explore/            # Catalog filtering & discovery
│   │   │   └── product/            # Dynamic product detail page ([slug] / [id])
│   │   ├── components/             # Storefront layout, cards, navbar, modals
│   │   ├── lib/                    # api.js client, auth validation, legal copy
│   │   ├── store/                  # Zustand store (cart, wishlist, auth state)
│   │   └── middleware.js           # Customer route middleware
│   ├── .env.example                # Customer environment variable template
│   ├── next.config.mjs             # Rewrites to backend API and image remote patterns
│   └── package.json
├── e2e/                            # Playwright End-to-End Test Suite
│   ├── tests/                      # 7 scenario test suites (search, cart, checkout, payment, etc.)
│   ├── custom-reporter.js          # Custom HTML and terminal test reporter
│   ├── global-setup.js             # Global authentication and environment verification
│   ├── playwright.config.js        # Playwright test execution configuration
│   ├── .env.example                # E2E test suite environment variable template
│   └── package.json
├── selenium/                       # Python Pytest + Selenium Test Suite
│   ├── tests/                      # Test cases for storefront and admin panel
│   ├── utils/                      # Selenium webdriver helpers, DB reset utilities, constants
│   ├── conftest.py                 # Pytest fixtures and browser lifecycle hooks
│   ├── pytest.ini                  # Pytest configuration
│   ├── requirements.txt            # Python dependencies (selenium, pytest, faker, etc.)
│   └── .env.example                # Selenium environment variable template
├── Jenkinsfile                     # Jenkins CI pipeline for automated E2E testing
└── README.md                       # This file
```

---

## 5. Prerequisites

Before setting up AuraZone locally, ensure your machine has the following dependencies installed:

*   **Node.js**: `v20.x` or `v24.x` (Verified with Node `v24.21.0`)
*   **Package Manager**: `pnpm` (`v10.x` recommended, e.g. `10.29.3` / `10.34.6`) or `npm` (`11.x`)
*   **Database**: PostgreSQL `v14+` running locally or accessible remotely
*   **Python (Optional)**: Python `3.10+` (only needed if running the `selenium/` test suite)
*   **Third-Party Accounts**:
    *   **Razorpay**: Test Mode Key ID and Secret for payment simulation
    *   **Resend**: API Key for email sending (optional for local auth testing)
    *   **AWS S3**: Bucket and credentials for image upload testing (optional; placeholder buffers used in integration tests)

---

## 6. Installation and Local Setup

Follow these exact steps to initialize and run the full AuraZone ecosystem:

### Step 1: Clone the Repository
```bash
git clone https://github.com/Umar-Zansphere/aurazone.git
cd aurazone
```

### Step 2: Configure Environment Files
Create `.env` files for each component from their respective `.env.example` templates:

```bash
# On Linux / macOS / Git Bash:
cp backend/.env.example backend/.env
cp admin/.env.example admin/.env.local
cp customer/.env.example customer/.env.local
cp e2e/.env.example e2e/.env

# On Windows PowerShell:
Copy-Item backend/.env.example backend/.env
Copy-Item admin/.env.example admin/.env.local
Copy-Item customer/.env.example customer/.env.local
Copy-Item e2e/.env.example e2e/.env
```

Ensure `backend/.env` has a valid `DATABASE_URL` pointing to your PostgreSQL instance, and that `JWT_SECRET` matches across `backend/.env` and `admin/.env.local`.

### Step 3: Install Dependencies

```bash
# 1. Install Backend Dependencies
cd backend
pnpm install

# 2. Install Customer Storefront Dependencies
cd ../customer
pnpm install

# 3. Install Admin Dashboard Dependencies
cd ../admin
pnpm install

# 4. Install E2E Dependencies (Optional, for Playwright testing)
cd ../e2e
pnpm install
npx playwright install --with-deps chromium
```

### Step 4: Run Database Migrations and Seed Data

```bash
cd ../backend

# Generate Prisma Client
npx prisma generate

# Apply Database Migrations
npx prisma migrate deploy

# Seed Database with Admin, Customer, and Sample Footwear Catalog
npm run seed
```

---

## 7. Environment Configuration

### Backend (`backend/.env`)

| Variable Name | Required | Default / Example | Purpose |
| :--- | :---: | :--- | :--- |
| `PORT` | No | `5000` | Port for the Express server to listen on. |
| `NODE_ENV` | Yes | `development` | Runtime environment (`development`, `staging`, `production`). |
| `DATABASE_URL` | Yes | `postgresql://postgres:postgres@localhost:5432/aurazone_dev?schema=public` | PostgreSQL connection string with schema parameter. |
| `JWT_SECRET` | Yes | `your_jwt_secret_min_32_chars` | Secret key used for signing authentication access tokens. |
| `JWT_EXPIRES_IN` | Yes | `7d` | Access token lifespan. |
| `JWT_REFRESH_EXPIRES_IN` | Yes | `604800` | Refresh token duration in seconds (7 days). |
| `CLIENT_URL` | Yes | `http://localhost:3000` | URL of the customer frontend (used for CORS and transactional email links). |
| `ADMIN_URL` | Yes | `http://localhost:3001` | URL of the admin frontend (used for CORS). |
| `RESEND_API_KEY` | Optional | `re_...` | Resend API key for transactional emails. |
| `EMAIL_FROM` | Optional | `AuraZone <noreply@aurazone.shop>` | Sender address for transactional emails. |
| `AWS_REGION` | Optional | `us-east-1` | AWS S3 region for product image uploads. |
| `AWS_ACCESS_KEY_ID` | Optional | `AKIA...` | AWS IAM access key ID with S3 permissions. |
| `AWS_SECRET_ACCESS_KEY` | Optional | `...` | AWS IAM secret access key. |
| `S3_BUCKET_NAME` | Optional | `aurazone-media-dev` | Target S3 bucket name. |
| `RAZORPAY_KEY_ID` | Optional | `rzp_test_...` | Razorpay API key ID for payment initialization. |
| `RAZORPAY_KEY_SECRET` | Optional | `...` | Razorpay secret key for payment verification & webhooks. |
| `RAZORPAY_WEBHOOK_DEBUG` | Optional | `false` | Enables extra logging for webhook payloads. |
| `VAPID_PUBLIC_KEY` | Optional | `...` | Web Push VAPID public key. |
| `VAPID_PRIVATE_KEY` | Optional | `...` | Web Push VAPID private key. |
| `VAPID_SUBJECT` | Optional | `mailto:admin@aurazone.shop` | Web Push contact URI. |

### Admin Dashboard (`admin/.env.local`)

| Variable Name | Required | Default / Example | Purpose |
| :--- | :---: | :--- | :--- |
| `PORT` | No | `3001` | Admin development server port. |
| `NEXT_PUBLIC_API_URL` | Yes | `http://localhost:5000` | Backend API URL for Next.js rewrites. |
| `NEXT_PUBLIC_APP_URL` | No | `http://localhost:3001` | Public URL of the admin dashboard. |
| `JWT_SECRET` | Yes | *Must match backend* | Used by Edge middleware (`src/middleware.js`) to verify admin JWTs. |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Optional | *Must match backend* | VAPID public key for browser push notification subscription. |
| `OPENROUTER_API_KEY` | Optional | `sk-or-v1-...` | API key for AI product content generator. |
| `OPENROUTER_MODEL` | Optional | `openai/gpt-4o-mini` | Model for AI copy generation. |

### Customer Storefront (`customer/.env.local`)

| Variable Name | Required | Default / Example | Purpose |
| :--- | :---: | :--- | :--- |
| `PORT` | No | `3000` | Customer development server port. |
| `NEXT_PUBLIC_API_URL` | Yes | `http://localhost:5000` | Backend API URL for Next.js rewrites (`/api/*`). |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | Optional | `rzp_test_...` | Razorpay client key ID for opening the checkout modal. |
| `NEXT_PUBLIC_ENABLE_COD` | No | `true` | Feature flag to enable or disable the Cash on Delivery checkout option. |

---

## 8. Running the Application

For a full local development experience, run the backend, customer storefront, and admin panel in separate terminal windows:

### 1. Start the Backend API (Port 5000)
```bash
cd backend
pnpm start
# Server running on Port: 5000
```

### 2. Start the Customer Storefront (Port 3000)
```bash
cd customer
pnpm run dev
# Ready in http://localhost:3000
```

### 3. Start the Admin Dashboard (Port 3001)
```bash
cd admin
pnpm run dev -- -p 3001
# Ready in http://localhost:3001
```

---

## 9. Application Workflows

### Authentication & Guest-to-User Session Migration

```mermaid
sequenceDiagram
    autonumber
    actor Customer as Unauthenticated Visitor
    participant Browser as Browser Client
    participant CustomerApp as Next.js Storefront
    participant Backend as Express Backend
    participant DB as PostgreSQL Database

    Customer->>Browser: Opens store & browses shoes
    Browser->>Backend: POST /api/session/create
    Backend->>DB: Create GuestSession (UUID, expires in 30d)
    Backend-->>Browser: Set guestSessionId cookie & return session
    Customer->>Browser: Adds shoe to cart
    Browser->>Backend: POST /api/cart (x-session-id: UUID)
    Backend->>DB: Upsert Cart & CartItem linked to guestSessionId
    Customer->>Browser: Decides to Log in
    Browser->>Backend: POST /api/auth/login (email, password, x-session-id)
    Backend->>DB: Verify user credentials & role
    Backend->>DB: Transaction: Reassign guest Cart & Wishlist to User ID
    Backend->>DB: Delete GuestSession
    Backend-->>Browser: Set accessToken (HTTP-only) & Clear guestSessionId cookie
    Browser->>CustomerApp: Redirect to authenticated view with merged cart
```

### Order Placement, Payment, and Inventory Lifecycle

```mermaid
stateDiagram-v2
    [*] --> CartActive: Add items to Cart
    CartActive --> OrderCreated: POST /api/orders (Address, PaymentMethod)

    state OrderCreated {
        [*] --> ReservedStock: Increment variant.reserved
        ReservedStock --> LogHold: Insert InventoryLog (type: HOLD)
    }

    OrderCreated --> COD_Processing: PaymentMethod = COD
    OrderCreated --> Razorpay_Pending: PaymentMethod = RAZORPAY

    COD_Processing --> Received: Order status = RECEIVED, Payment = PENDING

    Razorpay_Pending --> Razorpay_Success: POST /api/orders/payment/verify OR Webhook captured
    Razorpay_Pending --> Razorpay_Failed: Payment failed / signature mismatch

    state Razorpay_Success {
        [*] --> DecrementStock: Decrement variant.quantity
        DecrementStock --> ReleaseReserved: Decrement variant.reserved
        ReleaseReserved --> LogSold: Insert InventoryLog (type: SOLD)
    }

    Razorpay_Success --> Received: Order status = RECEIVED, Payment = SUCCESS
    Razorpay_Failed --> Cancelled: Payment status = FAILED

    Received --> Shipped: Admin marks SHIPPED + adds tracking number
    Shipped --> Delivered: Admin marks DELIVERED

    Received --> Cancelled: Customer/Admin cancels order
    state Cancelled {
        [*] --> ReleaseStock: Decrement variant.reserved
        ReleaseStock --> LogRelease: Insert InventoryLog (type: RELEASE)
    }

    Delivered --> [*]
    Cancelled --> [*]
```

---

## 10. API Documentation

The backend exposes **119 REST endpoints** structured under `/api`. Below is a reference of the primary business modules. For the exhaustive specification of every endpoint, header, request schema, and response contract, refer to [`backend/api/MANUAL_API_LAUNCH_TEST_PLAN.md`](file:///d:/Zansphere/aurazone/backend/api/MANUAL_API_LAUNCH_TEST_PLAN.md).

### 1. Authentication & Session (`/api/auth`, `/api/session`)

*   `POST /api/auth/signup` — Registers new customer with email and password.
*   `POST /api/auth/login` — Authenticates user, issues `accessToken` cookie, and triggers guest-session migration if `x-session-id` is provided. Rate limited to 10 attempts per 15 minutes.
*   `GET /api/auth/verify-email?token=` — Validates email verification token.
*   `POST /api/auth/forgot-password` — Sends password reset link via Resend.
*   `POST /api/auth/reset-password` — Sets new password using verification token.
*   `POST /api/auth/change-password` — Authenticated password change (requires `accessToken`).
*   `POST /api/auth/logout` — Clears `accessToken` cookie.
*   `POST /api/auth/phone-login` & `POST /api/auth/phone-login-verify` — OTP-based phone authentication. Rate limited to 5 requests per 15 minutes.
*   `POST /api/session/create` — Generates a guest session ID for unauthenticated visitors.

### 2. Product Catalog (`/api/products`)

*   `GET /api/products` — Public catalog with pagination and query filtering:
    *   Query parameters: `category`, `gender`, `minPrice`, `maxPrice`, `search`, `page`, `limit`.
*   `GET /api/products/:id` — Detailed product view including all active variants, sizes, colors, and image galleries.

### 3. Cart & Wishlist (`/api/cart`, `/api/wishlist`)

*   `GET /api/cart` — Retrieves current cart for authenticated user or guest session.
*   `POST /api/cart` — Adds item to cart (`variantId`, `quantity`).
*   `PUT /api/cart/items/:id` — Updates cart item quantity.
*   `DELETE /api/cart/items/:id` — Removes an item from the cart.
*   `DELETE /api/cart` — Clears all items in the active cart.
*   `GET /api/wishlist` — Retrieves wishlist.
*   `POST /api/wishlist/toggle` — Toggles a product variant in the wishlist.

### 4. Orders & Checkout (`/api/orders`)

*   `POST /api/orders` — Creates order from active cart items.
    *   Body: `{ addressId, paymentMethod: 'COD' | 'RAZORPAY' }` (or embedded guest address object).
    *   Reserves inventory across all item variants in an atomic transaction.
*   `POST /api/orders/direct` — Immediate "Buy Now" order bypasses the cart for a single variant.
*   `GET /api/orders` — Lists authenticated customer's past orders.
*   `GET /api/orders/:id` — Retrieves detailed order breakdown.
*   `GET /api/orders/track/:trackingToken` — Public endpoint to track shipment status without logging in.
*   `POST /api/orders/:id/cancel` — Customer cancellation (only allowed for orders in `PENDING` or `RECEIVED` status; releases inventory holds).
*   `POST /api/orders/payment/verify` — Validates Razorpay payment signature (`razorpay_order_id`, `razorpay_payment_id`, `razorpay_signature`).
*   `POST /api/orders/webhook/razorpay` — Webhook endpoint receiving Razorpay events (verifies `x-razorpay-signature` via HMAC-SHA256).

### 5. Admin Management (`/api/admin`)

*   `GET /api/admin/products` — Admin view of all products (including inactive and unlisted).
*   `POST /api/admin/products` — Creates product with variants and images.
*   `PUT /api/admin/products/:id` — Updates product attributes.
*   `POST /api/admin/variants/:id/images` — Uploads and optimizes product variant images (via Multer + Sharp + S3).
*   `GET /api/admin/orders` — Filterable order list (`status`, `paymentStatus`, date range).
*   `PUT /api/admin/orders/:id/status` — Updates status (`RECEIVED`, `SHIPPED`, `DELIVERED`, `CANCELLED`) with audit log creation.
*   `POST /api/admin/shipments` — Creates shipment record with courier name and tracking URL.
*   `POST /api/admin/inventory/adjust` — Manual stock override (`RESTOCK`, `REDUCE`, `HOLD`, `RELEASE`).
*   `GET /api/admin/analytics/overview` — High-level metric aggregates (Gross Revenue, Total Orders, AOV).

### 6. Notifications (`/api/notifications`)

*   `POST /api/notifications/subscribe` — Registers browser VAPID push subscription endpoint and keys.
*   `GET /api/notifications` — Fetches user notification history.
*   `PATCH /api/notifications/:id/read` — Marks notification as read.

---

## 11. Database and Data Management

The persistence layer is governed by **Prisma ORM** connecting to PostgreSQL.

### Core Data Models

*   `User`: Customer and Admin accounts, hashed passwords, verification flags, roles (`CUSTOMER`, `ADMIN`).
*   `GuestSession`: Temporary guest identifier (`sessionId`, expiration timestamp).
*   `Product`: Footwear model details, brand, category (`RUNNING`, `CASUAL`, `FORMAL`, `SNEAKERS`), gender (`MEN`, `WOMEN`, `UNISEX`, `KIDS`), description, tags.
*   `ProductVariant`: SKU, size, color, price, compare-at price, availability flag.
*   `Inventory`: One-to-one with `ProductVariant`; tracks available `quantity` and `reserved` counts.
*   `InventoryLog`: Immutable audit trail of every stock modification (`HOLD`, `RELEASE`, `SOLD`, `MANUAL`, `RESTOCK`, `RETURN`).
*   `Cart` & `CartItem`: Items currently staged for purchase; unique index on `[userId, status]` and `[sessionId, status]`.
*   `Wishlist` & `WishlistItem`: Saved items.
*   `Order` & `OrderItem`: Finalized customer purchases with unique `orderNumber` and `trackingToken`.
*   `Payment` & `PaymentLog`: Recorded payment transactions and status changes.
*   `OrderShipment` & `ShipmentLog`: Courier tracking information and milestone updates.
*   `OrderStatusEmailLog`: Audit record of outgoing transactional emails.
*   `PushSubscription` & `NotificationHistory`: Web Push browser endpoints and notification logs.

### Database Operations

```bash
# Apply migrations to production/staging
npx prisma migrate deploy

# Create a new migration during development
npx prisma migrate dev --name <migration_name>

# Inspect database visually via Prisma Studio
npx prisma studio

# Seed the database
npm run seed
```

### Default Seed Accounts
When running `npm run seed`, the database is populated with the following credentials:
*   **Admin User**: `admin@aurazone.com` / `Admin@123456` (Phone: `9442442233`)
*   **Test Customer**: `umar.zangroups@gmail.com` / `Umar2468/us!` (Phone: `9500693343`)

---

## 12. Authentication and Authorization

### Security Architecture

1.  **JWT Signing**: Tokens are signed with `HS256` using `JWT_SECRET`. Tokens embed the user's ID and role (`ADMIN` or `CUSTOMER`).
2.  **Cookie Transmission**: Tokens are delivered in an `accessToken` cookie configured with:
    *   `httpOnly: true` (prevents XSS extraction)
    *   `secure: true` (enforces HTTPS)
    *   `sameSite: 'none'` (enables cross-subdomain API communication)
    *   `maxAge: 7 * 24 * 60 * 60 * 1000` (7-day lifespan)
3.  **Role Enforcement**:
    *   Backend routes under `/api/admin` enforce `verifyAdminToken` middleware, returning `403 Forbidden` for non-admin accounts.
    *   The Admin frontend uses Next.js Edge Middleware (`admin/src/middleware.js`) to intercept every request, verify the JWT payload via `jose`, and redirect unauthenticated or non-admin requests to `/login` or `/unauthorized`.
4.  **Rate Limiting**:
    *   Login endpoint (`/api/auth/login`): 10 requests per 15 minutes per IP.
    *   OTP generation endpoints: 5 requests per 15 minutes per IP.

---

## 13. Testing and Quality Checks

### Test Suite Summary

| Test Suite | Location | Tooling | Purpose | Command |
| :--- | :--- | :--- | :--- | :--- |
| **Backend Integration** | `backend/__tests__/` | Jest 30, Supertest 7 | Integration tests for all route modules against a live test DB | `cd backend && npm test` |
| **Admin Unit & Component** | `admin/__tests__/` | Jest 30, RTL 16 | Middleware, hooks, formatting, component tests | `cd admin && npm test` |
| **Customer Storefront** | `customer/__tests__/` | Jest 30, RTL 16, SWC | Middleware, cart store, component unit tests | `cd customer && npm test` |
| **Playwright E2E** | `e2e/tests/` | Playwright 1.58 | End-to-end customer and admin browser user flows | `cd e2e && npx playwright test` |
| **Selenium E2E** | `selenium/tests/` | Pytest 8, Selenium 4 | Python-based browser regression tests | `cd selenium && pytest` |

### Running the Tests

#### 1. Backend Integration Tests
*Note: Requires PostgreSQL to be running and `backend/.env` configured.*
```bash
cd backend
npm test
```

#### 2. Admin & Customer Unit Tests
```bash
# Admin tests
cd admin
npm test

# Customer tests
cd customer
npm test
```

#### 3. Playwright End-to-End Tests
Ensure both the backend (port 5000) and frontend (port 3000/3001) are running:
```bash
cd e2e
npx playwright test

# To run with a visible browser:
npx playwright test --headed

# To inspect the interactive UI runner:
npx playwright test --ui
```

---

## 14. Build and Deployment

### Production Build Commands

```bash
# 1. Build Backend (Prisma Client generation)
cd backend
npm run build

# 2. Build Customer Storefront (Next.js production build)
cd ../customer
npm run build

# 3. Build Admin Dashboard (Next.js production build)
cd ../admin
npm run build
```

### Production Deployment Topology
*   **Customer Storefront & Admin Dashboard**: Deploy to **Vercel** or containerized Node.js servers (e.g. AWS ECS / Cloud Run).
    *   Ensure `NEXT_PUBLIC_API_URL` points to the production backend domain (e.g. `https://api.aurazone.shop`).
*   **Backend API**: Deploy to a Node.js runtime (e.g. AWS ECS, Render, Railway, DigitalOcean App Platform).
    *   Set `NODE_ENV=production`.
    *   Run `npx prisma migrate deploy` in the release phase before starting the server.
*   **Database**: Managed PostgreSQL instance (e.g. AWS RDS, Neon, Supabase) with connection pooling.
*   **Media Assets**: AWS S3 with a CloudFront CDN distribution in front of the bucket.

---

## 15. Logging, Monitoring, and Troubleshooting

### Logging Strategy
*   **Server Logs**: Standard Express error logging outputting `err.statusCode` and stack traces to `stderr`.
*   **Auditing**: Business-critical transitions (inventory adjustments, payment state updates, shipment status changes) write immutable log entries directly into PostgreSQL (`InventoryLog`, `PaymentLog`, `ShipmentLog`).

### Common Troubleshooting Scenarios

1.  **CORS Error: `Not allowed by CORS`**:
    *   *Cause*: Request origin is not in the backend whitelist.
    *   *Fix*: Inspect `allowedOrigins` in `backend/app.js`. By default, it allows `http://localhost:3000`, `http://localhost:3001`, `*.vercel.app`, and `*.aurazone.shop`. Add your custom domain to `allowedOrigins` or set `CLIENT_URL` / `ADMIN_URL`.
2.  **Frontend API Calls Fail with 404/500**:
    *   *Cause*: Missing or incorrect `NEXT_PUBLIC_API_URL` in `customer/.env.local` or `admin/.env.local`.
    *   *Fix*: Ensure `NEXT_PUBLIC_API_URL=http://localhost:5000` is set so Next.js rewrites can forward `/api/*` traffic.
3.  **Database Connection Failed (`503` on `/health`)**:
    *   *Cause*: PostgreSQL service is not running or `DATABASE_URL` credentials are invalid.
    *   *Fix*: Verify PostgreSQL is active (`SELECT 1`), confirm username/password in `backend/.env`, and verify network connectivity.
4.  **Razorpay Payment Verification Signature Mismatch**:
    *   *Cause*: Mismatched `RAZORPAY_KEY_SECRET` between the Razorpay dashboard and `backend/.env`.
    *   *Fix*: Re-copy the exact test key ID and secret from the Razorpay dashboard into `backend/.env`.

---

## 16. Known Issues and Technical Debt

1.  **Unused Queue Dependencies (`bullmq`, `ioredis`)**:
    *   *Details*: `bullmq` and `ioredis` are declared in `backend/package.json`, but no Redis client or queue worker is currently instantiated. Transactional emails and push notifications run synchronously or in un-queued promises.
    *   *Recommendation*: Implement a BullMQ worker for asynchronous email dispatch and expiring unfulfilled COD/Razorpay reservations after a configurable timeout.
2.  **Unused `jsonwebtoken` Dependency in Customer App**:
    *   *Details*: `customer/package.json` includes `jsonwebtoken`, but the customer frontend does not decode tokens on the client (all auth state is handled via cookies and backend API).
    *   *Recommendation*: Safely remove `jsonwebtoken` from `customer/package.json` in a scheduled dependency cleanup.
3.  **Hardcoded Credentials in `Jenkinsfile`**:
    *   *Details*: Lines 17–24 of `Jenkinsfile` contain test credentials (`ADMIN_PASSWORD`, `CUSTOMER_PASSWORD`, `WEBHOOK_SECRET`) hardcoded as strings instead of pulling from Jenkins Credentials Store.
    *   *Recommendation*: Migrate all test credentials to Jenkins Credentials (`credentials('...')`).
4.  **`authService.logout` Session Revocation**:
    *   *Details*: In `backend/api/controllers/auth.controller.js`, `authService.logout` was commented out because the controller holds an `accessToken` while `authService.logout` expected a `refreshTokenHash`. Currently, logout clears the cookie but leaves the `UserSession` record in the database.
    *   *Recommendation*: Align session tracking by storing the access token hash or session ID to allow full database revocation upon logout.

---

## 17. Code Maintenance Guidelines

*   **Error Handling**: Wrap asynchronous Express controller functions with the `catchAsync` higher-order utility (`backend/utils/catchAsync.js`) and throw `createError(statusCode, message)` from `backend/utils/error.js`.
*   **Express Middleware Order**: Always register route handlers before the global error handling middleware `app.use((err, req, res, next) => ...)`.
*   **Database Schema Changes**: Never modify migrations manually. Always alter `backend/prisma/schema.prisma` and run `npx prisma migrate dev --name <description>`.
*   **Zero Secret Logging**: Never log raw tokens, authorization headers, or environment secrets to `console.log`. Use structured loggers for application events.

---

## 18. KT Handoff Checklist

For engineers taking over this project, complete the following verification steps:

*   [ ] **Runtime Check**: Confirm Node.js v20+ and pnpm v10+ are active.
*   [ ] **PostgreSQL Check**: Confirm local or remote PostgreSQL connection.
*   [ ] **Environment Setup**: Copy `.env.example` templates to `.env` files in `backend`, `admin`, `customer`, and `e2e`.
*   [ ] **Database Initialization**: Run `npx prisma migrate deploy` and `npm run seed`.
*   [ ] **Service Launch**: Launch backend (port 5000), customer (port 3000), and admin (port 3001).
*   [ ] **Health Verification**: Query `GET http://localhost:5000/health` and verify `{"status": "healthy"}`.
*   [ ] **Admin Portal Verification**: Log in at `http://localhost:3001/login` with `admin@aurazone.com` / `Admin@123456`.
*   [ ] **Customer Journey Verification**: Browse `http://localhost:3000`, add an item to cart, and place a test COD order.
*   [ ] **Order Lifecycle Verification**: In the admin panel, find the order and transition status to `SHIPPED` and `DELIVERED`.
*   [ ] **Automated Test Run**: Execute unit tests (`npm test` in `admin` and `customer`).

---

## 19. Useful References

*   **API Specification & Launch Plan**: [`backend/api/MANUAL_API_LAUNCH_TEST_PLAN.md`](file:///d:/Zansphere/aurazone/backend/api/MANUAL_API_LAUNCH_TEST_PLAN.md)
*   **Prisma Database Schema**: [`backend/prisma/schema.prisma`](file:///d:/Zansphere/aurazone/backend/prisma/schema.prisma)
*   **Playwright Test Scenarios**: [`e2e/README.md`](file:///d:/Zansphere/aurazone/e2e/README.md)
*   **Jenkins CI Pipeline**: [`Jenkinsfile`](file:///d:/Zansphere/aurazone/Jenkinsfile)
*   **VAPID Key Generation Utility**: [`backend/scripts/generate-vapid-keys.js`](file:///d:/Zansphere/aurazone/backend/scripts/generate-vapid-keys.js)
