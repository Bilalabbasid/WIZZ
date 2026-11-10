# WIZZ.PK — Cloudways Deployment Runbook

Deploy WIZZ.PK on **Cloudways Managed Node.js hosting (Velocity)**. Velocity runs always-on Node.js servers, deploys from GitHub, and provisions PostgreSQL from the dashboard, which is what this app needs.

> Do not use a classic Cloudways PHP server (WordPress/Laravel/Custom PHP stack). WIZZ.PK needs a long-running Node.js process and PostgreSQL.

---

## 1. Before you start

- A GitHub repository with this code (`Bilalabbasid/WIZZ`, branch `main`).
- A domain you control (e.g. `wizz.pk`).
- Recommended: an S3-compatible bucket for uploads (Cloudflare R2, AWS S3, Wasabi). See section 5.
- Recommended plan: **Professional (4 GB RAM)** or larger. `next build` can use 1.5–2 GB; the 2 GB plan may run out of memory while building.

Generate three secrets on any machine (each must be different):

```bash
openssl rand -base64 32
```

---

## 2. Create the app

1. Cloudways dashboard → **Velocity / Node.js** → create an application.
2. **Repository**: connect GitHub and pick `Bilalabbasid/WIZZ`, branch `main`.
3. **Node.js version**: 22.x or 24.x.
4. **Database**: provision PostgreSQL for the app and copy its connection string.
5. Replace the auto-detected commands with:

| Field | Value |
| :--- | :--- |
| Build command | `npm ci --include=dev && npm run deploy:build` |
| Start command | `npm start` |
| Health check path (if offered) | `/api/health` |

Why these commands:
- `npm ci --include=dev` installs build tools (Prisma CLI, Tailwind, TypeScript, tsx) even if the platform sets `NODE_ENV=production` before install.
- `npm run deploy:build` runs, in order:
  1. `scripts/check-deploy-env.js`: stops the deploy with a clear list if required variables are missing or still placeholders.
  2. `prisma generate` and `prisma db push`: creates/updates database tables. It refuses changes that would delete data.
  3. `scripts/bootstrap-production.ts`: creates the WIZZ.PK Direct store, the 6 categories and (once) your admin account. Safe to run on every deploy; it never overwrites admin edits.
  4. `npm run build`: Next.js production build (standalone output).
- `npm start` runs `scripts/start-server.js`, which starts `.next/standalone/server.js` bound to `0.0.0.0` on the platform's `PORT`. (`next start` does not work with standalone output.)

---

## 3. Environment variables

Add these in the app's environment settings **before the first deploy**.

### Required

| Variable | Value |
| :--- | :--- |
| `NODE_ENV` | `production` |
| `DATABASE_URL` | Connection string of the Cloudways PostgreSQL database. Append `?schema=public&connection_limit=10` (and `&sslmode=require` if Cloudways requires SSL). |
| `APP_URL` | `https://wizz.pk` |
| `NEXT_PUBLIC_APP_URL` | `https://wizz.pk` |
| `JWT_SECRET` | secret #1 (32+ chars) |
| `CRON_SECRET` | secret #2 |
| `PAYMENT_WEBHOOK_SECRET` | secret #3 |
| `ADMIN_EMAIL` | your admin login email |
| `ADMIN_PASSWORD` | a strong password (12+ chars). Used only to create the admin the first time. |

### Email (order confirmations)

| Variable | Example |
| :--- | :--- |
| `SMTP_HOST` | `smtp.your-provider.com` |
| `SMTP_PORT` | `465` |
| `SMTP_SECURE` | `true` |
| `SMTP_USER` | `orders@wizz.pk` |
| `SMTP_PASSWORD` | mailbox password |
| `SMTP_FROM` | `WIZZ.PK <orders@wizz.pk>` |

### Uploads (recommended)

| Variable | Example |
| :--- | :--- |
| `S3_BUCKET` | `wizz-pk-media` |
| `S3_REGION` | `auto` |
| `S3_ENDPOINT` | `https://<account_id>.r2.cloudflarestorage.com` |
| `S3_ACCESS_KEY_ID` | key id |
| `S3_SECRET_ACCESS_KEY` | key secret |
| `S3_PUBLIC_URL` | public URL of the bucket, e.g. `https://media.wizz.pk` |

### Optional

| Variable | Default | Purpose |
| :--- | :--- | :--- |
| `FEATURE_SELLER_PORTAL_ACTIVE` | `false` | `true` to open seller registration and the Seller Center |
| `FEATURE_MARKETPLACE_SETTLEMENTS` | `false` | `true` to enable seller settlements |
| `FEATURE_GUEST_CHECKOUT` | `true` | allow checkout without an account |
| `SUPPORT_EMAIL` / `SUPPORT_PHONE` | | shown on the store |
| `SEED_DEMO_CATALOG` | unset | `true` loads the 52-product demo catalog during the build. **Staging only** (it archives published products that are not in the demo list). Remove it after one deploy. |
| `ADMIN_RESET_PASSWORD` | unset | `true` resets `ADMIN_EMAIL`'s password to `ADMIN_PASSWORD` on the next deploy. Remove it afterwards. |
| `SCHEDULER_INTERVAL_SECONDS` | `60` | how often background maintenance runs |

Check the list locally against a copy of your production values with `npm run check:env`.

---

## 4. Deploy and verify

1. Click **Deploy**. In the build log you should see:
   - `✓ Deploy environment looks complete.`
   - `[bootstrap] Created platform admin you@example.com` (first deploy only)
   - `✓ Compiled successfully`
2. Open `https://<app-url>/api/health` → `{"status":"healthy","database":"connected",...}`
3. Map your domain in the dashboard (SSL is issued automatically), then update `APP_URL` / `NEXT_PUBLIC_APP_URL` if they changed and redeploy.
4. Sign in at `/login` with `ADMIN_EMAIL` / `ADMIN_PASSWORD`. The admin panel is at `/admin`; WIZZ.PK Direct listings are managed at `/seller/portal/products`.

---

## 5. Uploaded files

Product photos and seller KYC documents are stored:
- in S3/R2 when all `S3_*` variables are set (recommended), or
- on the server disk at `UPLOAD_DIR` (default `./.uploads`).

If you use the disk, confirm with Cloudways that this folder survives redeploys; otherwise uploads are lost on every deploy. The deploy check prints a warning while S3 is not configured.

---

## 6. Background jobs

The app runs its own scheduler inside the server process (expired stock holds, unpaid-order timeouts, queued emails, deal start/end). Velocity keeps the process running, so nothing extra is required.

Backup trigger (recommended): create a free job at an external cron service (e.g. cron-job.org) every 5 minutes:

- URL: `https://wizz.pk/api/cron/cleanup`
- Method: `POST` (or `GET`)
- Header: `Authorization: Bearer <CRON_SECRET>`

---

## 7. Updating the site

Push to `main`, then deploy from the dashboard (or enable auto-deploy). Each deploy re-runs the env check, the schema update, the bootstrap and the build.

---

## 8. Troubleshooting

| Symptom | Fix |
| :--- | :--- |
| Build stops with `Deploy configuration errors` | Set the listed variables, redeploy. |
| Build fails with `Cannot find module '@tailwindcss/postcss'` or `prisma: not found` | The build command must start with `npm ci --include=dev`. |
| Build killed / out of memory | Use a plan with 4 GB RAM or more. |
| Site returns 502 after a successful build | Start command must be `npm start` (not `next start`). Check the runtime log for `[start] WIZZ.PK listening on http://0.0.0.0:<PORT>`. |
| `/api/health` shows `database: disconnected` | Check `DATABASE_URL`; add `&sslmode=require` if the database requires SSL. |
| `FATAL CONFIG ERROR: JWT_SECRET` in logs | `JWT_SECRET` must be 32+ characters. |
| Emails not sent | Set all `SMTP_*` variables; failed emails are retried by the scheduler. |
| Can't sign in as admin | Set `ADMIN_RESET_PASSWORD=true`, deploy once, sign in, then remove it. |
