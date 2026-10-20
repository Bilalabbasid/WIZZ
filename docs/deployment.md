# WIZZ.PK — Deployment & Operations Guide

## 1. Environment Configuration

Create a `.env` file in the project root based on the following reference:

```env
# --- Application Configuration ---
NODE_ENV="production"
PORT=3000
APP_URL="https://wizz.pk"
NEXT_PUBLIC_APP_URL="https://wizz.pk"
BRAND_NAME="WIZZ.PK"
DEFAULT_CURRENCY="USD"
DEFAULT_LOCALE="en-US"

# --- Database (PostgreSQL) ---
# Format: postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public
DATABASE_URL="postgresql://postgres:sns123@127.0.0.1:5432/wizz_pk?schema=public"

# --- Security & Authentication ---
# Generate using: openssl rand -base64 32
JWT_SECRET="wizz-pk-super-secret-jwt-key-production-change-me-32chars"
SESSION_COOKIE_NAME="wizz_session"
SESSION_EXPIRY_DAYS=7

# --- Object Storage (Product Media & Private Documents) ---
# Drivers: "local" (development) | "s3" (production)
STORAGE_DRIVER="local"
STORAGE_LOCAL_DIR="./.uploads"

# AWS S3 / MinIO / Cloudflare R2 Settings (Required if STORAGE_DRIVER=s3)
S3_REGION="us-east-1"
S3_ENDPOINT=""
S3_ACCESS_KEY_ID=""
S3_SECRET_ACCESS_KEY=""
S3_PUBLIC_BUCKET="wizz-pk-public-assets"
S3_PRIVATE_BUCKET="wizz-pk-private-kyc"

# --- Payment Gateways ---
# Default: "LOCAL_SANDBOX" for testing, "STRIPE" for live processing
PAYMENT_PROVIDER="LOCAL_SANDBOX"
STRIPE_SECRET_KEY=""
STRIPE_WEBHOOK_SECRET=""
PAYMENT_WEBHOOK_SECRET="local_dev_webhook_signing_secret_998877"

# --- Feature Flags (Server-Enforced) ---
FEATURE_SELLER_PORTAL_ACTIVE="false"
FEATURE_MARKETPLACE_SETTLEMENTS="false"
FEATURE_GUEST_CHECKOUT="true"
FEATURE_REVIEWS_MODERATION="true"

# --- Background Worker & Cron Security ---
CRON_SECRET="wizz-cron-secure-token-992211"
```

---

## 2. Database Migration & Initialization

1. **Verify Database Connectivity**: Ensure PostgreSQL 15+ is running and the target database is created:
   ```bash
   # Create database if not exists
   psql -U postgres -h 127.0.0.1 -c "CREATE DATABASE wizz_pk;"
   ```
2. **Apply Migrations**:
   ```bash
   npx prisma migrate deploy
   ```
   *(For development synchronization, `npx prisma db push` can be used)*
3. **Generate Prisma Client**:
   ```bash
   npx prisma generate
   ```
4. **Seed Database with Baseline Data**:
   ```bash
   npm run seed
   ```
   This seeds:
   - Primary 1P seller organization: `WIZZ.PK`
   - Platform Super Administrator account (`admin@wizz.pk`)
   - Test customer account (`customer@wizz.pk`)
   - Test applicant account (`applicant@craftgear.com`)
   - Initial category taxonomy, brands, products, variants, and inventory levels.

---

## 3. Production Build & Execution

1. **Build the Application**:
   ```bash
   npm run build
   ```
2. **Start the Production Server**:
   ```bash
   npm run start
   ```

---

## 4. Background Job Execution

WIZZ.PK uses a durable database-backed background job queue for:
- Expired checkout reservation release (runs every 5 minutes).
- Transactional notification delivery.
- Inventory re-indexing.

### Execution Options:
1. **HTTP Cron Ping (Serverless / Edge Compatible)**:
   Invoke `POST /api/cron/cleanup` with header `Authorization: Bearer <CRON_SECRET>` via AWS EventBridge, Cloudflare Cron Triggers, or standard Linux cron:
   ```bash
   */5 * * * * curl -X POST https://wizz.pk/api/cron/cleanup -H "Authorization: Bearer $CRON_SECRET"
   ```
2. **Continuous Worker Daemon**:
   Run the background queue worker alongside the Next.js process:
   ```bash
   npm run worker
   ```

---

## 5. Health Checks & Monitoring

- **Application Health Endpoint**: `GET /api/health`
  - Responds with `200 OK` and JSON diagnostic telemetry:
    ```json
    {
      "status": "healthy",
      "timestamp": "2026-10-12T13:30:00.000Z",
      "database": "connected",
      "storage": "available",
      "version": "1.0.0"
    }
    ```
- **Error Tracking**: Global error boundaries and server-side exception logging mask sensitive credentials and financial data.
