# WIZZ.PK — HOSTINGER PRODUCTION DEPLOYMENT RUNBOOK

This guide details the exact, tested deployment process for launching **WIZZ.PK** on **Hostinger**.

---

## 1. Hosting Architecture & Requirements

WIZZ.PK is a full-stack, enterprise-grade Next.js e-commerce marketplace requiring a persistent Node.js server runtime, PostgreSQL database, persistent file storage, and background task processing.

### Supported Hostinger Plans
1. **Hostinger VPS (Recommended & Verified)**:
   - **Plans**: KVM 1, KVM 2, KVM 4, or KVM 8 running Ubuntu 22.04 / 24.04 LTS.
   - **Process Manager**: PM2 or Docker / systemd.
   - **Reverse Proxy**: Nginx or OpenLiteSpeed with SSL via Let's Encrypt / Certbot.
   - **Node.js Runtime**: Node.js 22.x LTS or newer (required).
2. **Hostinger Cloud / Business Web App**:
   - Uses Hostinger's Node.js Web App Manager. These plans include MySQL only, so use an external PostgreSQL database (e.g. Neon or Supabase) and put its URL in `DATABASE_URL`. Build command: `npm ci --include=dev && npm run deploy:build`.
   - Set Startup File to `scripts/start-server.js` or Run Command `npm start` (the wrapper binds to `0.0.0.0` on `PORT`).

---

## 2. Environment Variables Checklist

Create your production `.env` file from `.env.example`:

```bash
cp .env.example .env
```

| Variable | Required? | Example / Default | Description |
| :--- | :---: | :--- | :--- |
| `NODE_ENV` | **Yes** | `production` | Enforces production optimizations and disables mock sandboxes |
| `PORT` | **Yes** | `3000` | Port listened by the Next.js standalone server |
| `HOSTNAME` | **Yes** | `0.0.0.0` | Bind address to accept reverse-proxied traffic |
| `APP_URL` | **Yes** | `https://wizz.pk` | Canonical domain used for SEO, redirects, and canonical links |
| `NEXT_PUBLIC_APP_URL` | **Yes** | `https://wizz.pk` | Client-accessible base URL |
| `DATABASE_URL` | **Yes** | `postgresql://user:pass@host:5432/wizz_prod?schema=public&connection_limit=10` | PostgreSQL connection string |
| `JWT_SECRET` | **Yes** | `openssl rand -base64 32` | 32+ char secret for user session tokens & signed URLs |
| `CRON_SECRET` | **Yes** | `openssl rand -base64 32` | Bearer token authenticating `/api/cron/cleanup` |
| `PAYMENT_WEBHOOK_SECRET` | **Yes** | `openssl rand -base64 32` | HMAC-SHA256 signature key for payment webhooks |
| `UPLOAD_DIR` | Optional | `/var/data/wizz-uploads` | Directory for persistent local uploads on VPS |
| `S3_BUCKET` | Optional | `wizz-media` | S3/R2 bucket name for persistent cloud storage |
| `S3_ACCESS_KEY_ID` | Optional | `AKIA...` | S3 Access Key ID |
| `S3_SECRET_ACCESS_KEY` | Optional | `secret...` | S3 Secret Access Key |
| `S3_ENDPOINT` | Optional | `https://...` | S3 endpoint (for Cloudflare R2 or Hostinger Object Storage) |
| `SMTP_HOST` | **Yes** | `smtp.hostinger.com` | Hostinger SMTP server |
| `SMTP_PORT` | **Yes** | `465` | SSL SMTP port |
| `SMTP_SECURE` | **Yes** | `true` | Enable TLS/SSL |
| `SMTP_USER` | **Yes** | `orders@wizz.pk` | Hostinger email mailbox |
| `SMTP_PASSWORD` | **Yes** | `password` | Hostinger email password |
| `SMTP_FROM` | **Yes** | `WIZZ.PK <orders@wizz.pk>` | From header on customer emails |
| `FEATURE_SELLER_PORTAL_ACTIVE` | **Yes** | `true` | Enables multi-seller onboarding & merchant portal |
| `FEATURE_MARKETPLACE_SETTLEMENTS`| **Yes** | `true` | Enables merchant escrow & ledger settlements |
| `COD_MAX_LIMIT_PKR` | Optional | `50000` | Maximum order limit for Cash on Delivery (PKR 50,000) |

---

## 3. Step-by-Step Deployment Guide (Hostinger VPS)

### Step 1: Server Packages (Ubuntu 22.04 / 24.04 VPS)
Connect via SSH (`ssh root@<your-vps-ip>`) and install Node.js 22, Git, Nginx, PostgreSQL and PM2:

```bash
sudo apt update && sudo apt upgrade -y

# Node.js 22 LTS (the app requires Node 22 or newer)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs git nginx postgresql postgresql-contrib

node -v   # v22.x.x
sudo npm install -g pm2
```

### Step 2: Create the Database
```bash
sudo -u postgres psql
```
In the `psql` prompt (choose your own strong password):
```sql
CREATE USER wizz WITH PASSWORD 'choose-a-strong-db-password';
CREATE DATABASE wizz_pk_prod OWNER wizz;
\q
```
Your `DATABASE_URL` is then:
```
postgresql://wizz:choose-a-strong-db-password@127.0.0.1:5432/wizz_pk_prod?schema=public&connection_limit=10
```

### Step 3: Get the Code
```bash
git clone https://github.com/Bilalabbasid/WIZZ.git /var/www/wizz.pk
cd /var/www/wizz.pk
npm ci --include=dev
```

### Step 4: Create `.env`
```bash
cp .env.example .env
nano .env
```
Set at least: `DATABASE_URL` (from Step 2), `APP_URL` and `NEXT_PUBLIC_APP_URL` (`https://wizz.pk`), `JWT_SECRET`, `CRON_SECRET`, `PAYMENT_WEBHOOK_SECRET` (each from `openssl rand -base64 32`, all different), `ADMIN_EMAIL`, `ADMIN_PASSWORD` (12+ characters), the `SMTP_*` values and `UPLOAD_DIR="/var/data/wizz-uploads"` (or the `S3_*` values). Delete the `ADMIN_EMAIL`/`ADMIN_PASSWORD` placeholders if you do not want an admin created. Then:

```bash
chmod 600 .env
sudo mkdir -p /var/data/wizz-uploads && sudo chown -R $USER:$USER /var/data/wizz-uploads
```

> **NEVER** run `npm run seed` (`prisma/seed.ts`) in production: it creates demo accounts whose passwords are published in SETUP.md. It refuses to run with `NODE_ENV=production`.

### Step 5: Build
```bash
NODE_ENV=production npm run deploy:build
```
This checks `.env` (and stops with a list of problems if something is missing), creates/updates the database tables without deleting data, creates the WIZZ.PK Direct store, the categories and your admin account (first run only), then builds the site.

Optional, staging only: `SEED_DEMO_CATALOG=true NODE_ENV=production npm run deploy:build` also loads the 52-product demo catalog (it archives published products that are not in the demo list).

### Step 6: Start with PM2
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup        # run the command it prints, so the app starts after a reboot
curl -s http://127.0.0.1:3000/api/health   # {"status":"healthy",...}
```
`ecosystem.config.js` starts `scripts/start-server.js` on `127.0.0.1:3000` (only Nginx can reach it) and reads secrets from `.env` at every start. After editing `.env`, run `pm2 restart wizz-pk`.

### Updating to a new version
```bash
cd /var/www/wizz.pk
git pull
npm ci --include=dev
NODE_ENV=production npm run deploy:build
pm2 restart wizz-pk
```

### Step 7: Nginx Reverse Proxy & SSL Configuration
Point your domain's A record at the VPS IP first (Hostinger hPanel → DNS).
Create `/etc/nginx/sites-available/wizz.pk`:

```nginx
server {
    server_name wizz.pk www.wizz.pk;

    client_max_body_size 15M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Static assets caching
    location /_next/static {
        proxy_pass http://127.0.0.1:3000/_next/static;
        proxy_cache_valid 200 365d;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }
}
```

Enable site and provision SSL certificate:
```bash
sudo ln -s /etc/nginx/sites-available/wizz.pk /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

# Install free Let's Encrypt SSL
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d wizz.pk -d www.wizz.pk
```

---

## 4. Persistent Storage Configuration

### Option A: Local Persistent Disk (Hostinger VPS)
In your `.env`:
```env
UPLOAD_DIR="/var/data/wizz-uploads"
```
Ensure directory permissions:
```bash
sudo mkdir -p /var/data/wizz-uploads
sudo chown -R $USER:$USER /var/data/wizz-uploads
```

### Option B: S3 / Cloudflare R2 / Hostinger Object Storage (Zero-Loss)
In your `.env`:
```env
S3_BUCKET="wizz-production-media"
S3_REGION="auto"
S3_ENDPOINT="https://<account_id>.r2.cloudflarestorage.com"
S3_ACCESS_KEY_ID="your_access_key"
S3_SECRET_ACCESS_KEY="your_secret_key"
S3_PUBLIC_URL="https://media.wizz.pk"
```

---

## 5. Background Jobs & Scheduled Maintenance

WIZZ.PK includes an automated in-process worker (`src/instrumentation.ts`) that runs every 60 seconds:
- Automatically releases expired 15-minute checkout stock reservations.
- Cancels abandoned unpaid online payment orders after 30 minutes.
- Retries transient transactional emails.

### External Backup Cron Job (Recommended)
Add a server crontab as an external heartbeat trigger:
```bash
crontab -e
```
Add:
```cron
*/5 * * * * curl -s -X POST -H "Authorization: Bearer YOUR_CRON_SECRET" https://wizz.pk/api/cron/cleanup > /dev/null 2>&1
```

---

## 6. Backup, Restore & Rollback Procedures

### Daily PostgreSQL Backup
```bash
# Automated backup command
pg_dump -U db_user -h 127.0.0.1 wizz_pk_prod | gzip > /var/backups/wizz_db_$(date +\%F).sql.gz
```

### Database Restore
```bash
gunzip -c /var/backups/wizz_db_2026-10-20.sql.gz | psql -U db_user -h 127.0.0.1 -d wizz_pk_prod
```

### Application Rollback
```bash
# Return to previous commit
git checkout <previous-stable-commit-hash>
npm ci --include=dev
NODE_ENV=production npm run deploy:build
pm2 restart wizz-pk
```

---

## 7. Post-Deployment Smoke-Test Verification

Execute this checklist immediately after deployment on the live domain:

- [ ] **HTTPS & SSL**: `https://wizz.pk` loads with valid Let's Encrypt certificate and HSTS header.
- [ ] **Health Endpoint**: `https://wizz.pk/api/health` returns `HTTP 200` with `status: "healthy"`, `database: "connected"`, and `storage: "available"`.
- [ ] **Catalog & Discovery**: View `/products`, test category filters, search bar suggestions, and sort dropdowns.
- [ ] **Product Media**: Upload a new product image via the seller or admin portal and verify it loads on the storefront with `Content-Type: image/*`.
- [ ] **Customer Checkout (COD)**:
  - Add item to cart.
  - Proceed to checkout with Pakistan address (`0300 1234567`, city, province, 5-digit postal code).
  - Place COD order below PKR 50,000.
  - Verify receipt displays order number and payment due status.
- [ ] **Transactional Email**: Confirm that Hostinger SMTP dispatched the order confirmation email.
- [ ] **Order Tracking**: Open tracking URL `/orders/<id>` and verify that non-owners are blocked without guest HMAC token.
- [ ] **Admin Console**: Log in at `/login` with provisioned super admin credentials, access `/admin`, and verify review, inventory, and order fulfillment dashboards.
