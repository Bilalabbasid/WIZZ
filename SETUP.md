# WIZZ.PK — Local Setup & Operations Guide (SETUP.md)

**Brand Name**: `WIZZ.PK`  
**Domain**: `wizz.pk`  
**Stack**: Next.js 16 (App Router), TypeScript, PostgreSQL, Prisma, Tailwind CSS

---

## 1. Prerequisites
- **Node.js**: v20.x or higher
- **Package Manager**: `npm` (v10+)
- **PostgreSQL**: v14+ running locally or via Docker
- **Python**: 3.10+ (for `ui-ux-pro-max` design intelligence search tool)

---

## 2. Environment Variables (.env)

Ensure `.env` contains the required keys:

```ini
# Application Configuration
NODE_ENV="development"
PORT=3000
APP_URL="http://localhost:3000"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
BRAND_NAME="WIZZ.PK"
DEFAULT_CURRENCY="PKR"
DEFAULT_LOCALE="en-PK"

# Database (PostgreSQL)
DATABASE_URL="postgresql://postgres:sns123@127.0.0.1:5432/wizz_pk?schema=public"

# Security & Authentication
JWT_SECRET="wizz-pk-development-secret-jwt-key-min-32-chars-long!"
SESSION_COOKIE_NAME="wizz_session"
SESSION_EXPIRY_DAYS=7

# Object Storage (Local disk in dev, S3 in prod)
STORAGE_DRIVER="local"
STORAGE_LOCAL_DIR="./.uploads"
S3_REGION="ap-south-1"
S3_ENDPOINT=""
S3_ACCESS_KEY_ID=""
S3_SECRET_ACCESS_KEY=""
S3_PUBLIC_BUCKET="wizz-pk-public-assets"
S3_PRIVATE_BUCKET="wizz-pk-private-kyc"

# Payment Gateways (Pakistan Context)
PAYMENT_PROVIDER="LOCAL_SANDBOX"
PAYMENT_WEBHOOK_SECRET="local_dev_webhook_signing_secret_998877"

# Feature Flags (Server-Enforced)
FEATURE_SELLER_PORTAL_ACTIVE="false"
FEATURE_MARKETPLACE_SETTLEMENTS="false"
FEATURE_GUEST_CHECKOUT="true"
FEATURE_REVIEWS_MODERATION="true"

# Cron Maintenance Secret
CRON_SECRET="wizz-cron-secure-token-992211"
```

---

## 3. Database Initialization & Seeding

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Create / update the database schema and Prisma client** (schema changes such as the scheduled-deal columns on `ProductVariant` need this):
   ```bash
   npx prisma db push
   npx prisma generate
   ```

3. **Seed initial catalog and default accounts**:
   ```bash
   npm run seed
   ```

4. **(Optional) Load the full demo catalog** (52 products across 6 categories, 4 demo stores, eye-checked photos from `scripts/catalog-photos.ts`). Local/staging only: it archives published products that are not in the demo registry.
   ```bash
   npx tsx scripts/seed-complete-diverse-catalog.ts
   ```

### Default Seeded Test Credentials:
- **Platform Super Admin**: `admin@wizz.pk` / `Admin@Wizz2026!`
- **Demo Customer**: `customer@wizz.pk` / `Customer@Wizz2026!`
- **Seller Applicant**: `applicant@craftgear.com` / `Seller@Wizz2026!`

---

## 4. Pakistan Payment Gateway Integration Blueprints

### 4.1 Cash on Delivery (COD)
- Fully functional out of the box. No external API credentials required.
- Orders are placed in `PROCESSING` status with `paymentStatus = UNPAID`.
- When courier remits collected cash, platform admins reconcile the order via `/api/admin/orders/[id]/cod-reconcile`.

### 4.2 Online Payment Providers (Requirements for Live Production)
To activate online card or wallet payments in Pakistan, configure the appropriate provider credentials in `.env`:

1. **Safepay (SBP-Licensed PSP)**:
   - Account: Merchant account with sandbox/production keys at `https://getsafepay.com`.
   - Keys required: `SAFEPAY_API_KEY`, `SAFEPAY_SECRET_KEY`, `SAFEPAY_WEBHOOK_SECRET`.
   - Supports: Visa/Mastercard debit and credit cards, EasyPaisa mobile wallets.

2. **PayFast (APPS / 1Link)**:
   - Account: Corporate merchant agreement with APPS / PayFast Pakistan.
   - Keys required: `PAYFAST_MERCHANT_ID`, `PAYFAST_SECURED_KEY`.
   - Supports: UnionPay, PayPak, Visa, Mastercard, Direct Bank Accounts (1Link).

3. **Kuickpay (1Link Bill Invoicing)**:
   - Account: Corporate 1Link utility biller / aggregator integration.
   - Provides 9-digit consumer bill IDs payable via ATM, mobile banking, and branch counters across 35+ Pakistani banks.

> **Note**: In local development, the `LOCAL_SANDBOX` payment adapter is active. Live transactions are never simulated without real API credentials.

---

## 5. Verification Commands

| Command | Action |
| :--- | :--- |
| `npm test` | Executes the 11-suite automated domain rules test (45 tests) |
| `npm run build` | Compiles Turbopack production bundle for all routes |
| `npm run dev` | Launches local development server on `http://localhost:3000` |
| `npm run start` | Starts production HTTP server on `http://localhost:3000` |
