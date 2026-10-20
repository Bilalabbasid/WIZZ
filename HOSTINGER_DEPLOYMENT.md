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
   - **Node.js Runtime**: Node.js 20.x LTS or 22.x LTS.
2. **Hostinger Cloud / Business Web App**:
   - Uses Hostinger's Node.js Web App Manager.
   - Set Startup File to `.next/standalone/server.js` or Run Command `npm start`.

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

### Step 1: Server Provisioning & Dependencies
Connect via SSH to your Hostinger VPS and install Node.js 20 LTS, Git, and PostgreSQL:

```bash
# Update packages
sudo apt update && sudo apt upgrade -y

# Install Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs git nginx

# Verify versions
node -v   # Should output v20.x.x
npm -v    # Should output 10.x.x

# Install PM2 globally
sudo npm install -g pm2
```

### Step 2: Clone Repository & Install Packages
```bash
git clone https://github.com/your-org/wizz.pk.git /var/www/wizz.pk
cd /var/www/wizz.pk

# Clean install exact production dependencies
npm ci
```

### Step 3: Database Migration & Schema Sync
```bash
# Push schema to production PostgreSQL (without deleting data)
npx prisma db push

# Generate Prisma Client
npx prisma generate
```

### Step 4: Secure Platform Super Administrator Provisioning
> **CRITICAL RULE**: NEVER run demo seed scripts (`prisma/seed.ts`) in production.
Provision the initial Super Administrator securely:

```bash
npx tsx scripts/create-admin.ts admin@wizz.pk 'YourVeryStrongPassword2026!' 'Platform Administrator'
```

### Step 5: Production Build & Asset Synchronization
```bash
# Runs next build with output: standalone and synchronizes static assets
npm run build
```

### Step 6: Configure PM2 Process Manager
Create or run PM2 to keep the standalone server running and restart on crash:

```bash
pm2 start .next/standalone/server.js --name "wizz-pk" --env PORT=3000,HOSTNAME=0.0.0.0
pm2 save
pm2 startup
```

### Step 7: Nginx Reverse Proxy & SSL Configuration
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
git reset --hard <previous-stable-commit-hash>
npm ci
npm run build
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
