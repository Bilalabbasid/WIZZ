# WIZZ.PK — Financial & Application Security Audit

**Date:** 12 November 2026 · **Scope:** whole application (storefront, seller center, admin console, APIs, database, payments, payouts, deployment).
**Method:** code review of every money path, fixes, then verification with automated suites against an isolated local database and live HTTP checks against a local server. No production system, real payment or real bank transfer was touched.

> This is an engineering assessment, **not** a compliance certification. Nothing here claims PCI DSS, SBP, or any other certification.

## How money flows today (context for every finding)

| Flow | How it works | Provider integration |
| :--- | :--- | :--- |
| Customer payment | **Cash on delivery only** in production. Online payment exists as a `LOCAL_SANDBOX` adapter that the server refuses when `NODE_ENV=production`. | None configured. A real PSP (Safepay / PayFast / etc.) is an **integration dependency**. |
| Cash collection | Courier collects; finance reconciles the courier remittance with its reference. | Manual (no courier API). |
| Refunds | Return → approve → item received → finance records the refund **with the real transfer reference**. Pending refunds from cancelled paid orders are completed the same way. | Manual transfer (no PSP refund API). |
| Seller payouts | Platform-initiated manual bank transfer, **maker-checker** (two different finance users). Sellers cannot withdraw on their own. | Manual transfer (no banking API). |
| Card data | **None stored, processed or transmitted** by this app. | — |

No banking passwords, PINs, CVVs, card numbers or bank logins exist anywhere in the system.

---

## 1. Critical vulnerabilities (all fixed and verified)

| # | Finding | Component | Business impact | Reproduce (safe env) | Fix & evidence |
| :- | :--- | :--- | :--- | :--- | :--- |
| C1 | Seller application accepted any field (status, `approvedOrgId`, reviewer fields) | `api/seller/application`, sellers services | A seller could approve themselves or attach their application to another store; on admin approval they became OWNER of that store and its bank details were overwritten → **payout redirection / store takeover** | POST draft with `{status:"APPROVED", approvedOrgId:"<other org>"}` | Field allow-list (zod), review only from SUBMITTED, approved org must be applicant-owned. Verified live: status stays DRAFT, org link ignored. |
| C2 | Store profile accepted any field | `api/seller/profile` | Self-activation of suspended/unapproved stores, **0% commission**, bank change by any team member | PUT `{operationalStatus:"ACTIVE", commissionRatePercent:0}` | Allow-list, OWNER/ADMIN only. Verified: store stays INACTIVE, commission 10%. |
| C3 | Returns could be approved/refunded repeatedly; refunds auto-marked SUCCEEDED with invented references | returns + seller order services | **Unlimited refunds**, phantom stock | Re-POST approve | State machine SUBMITTED→APPROVED→RECEIVED→REFUNDED with conditional updates; refund needs real reference; refund ≤ amount paid (`assertRefundWithinPaid`). Tests: double approve/refund refused; refund on unpaid COD refused. |
| C4 | Sellers could set any order status (e.g. DELIVERED without shipping) | seller order status | Escrow released as **payable without delivery** | PUT `{status:"DELIVERED"}` on a confirmed package | Transition map, DELIVERED only after dispatch, fulfilment roles only. Verified live. |
| C5 | Webhook event marked processed before the order update | payments webhook | Crash in between = **payment received but order never paid**, never retried | Kill between steps | Event claim + effect in one transaction; failure → 500 so the provider retries; reconciliation job. Test scenario 15 passes. |

## 2. High-risk vulnerabilities (fixed and verified)

| # | Finding | Impact | Fix & evidence |
| :- | :--- | :--- | :--- |
| H1 | Guest order pages readable by anyone with the order id | Customer name/phone/address disclosure | Signed access token required. |
| H2 | Seller registration response included the password hash | Credential exposure | Response allow-list. Verified. |
| H3 | Product APIs sent seller **cost price**; checkout totals sent commission & seller payouts | Commercial data leak | `omit costPriceMinor`; public totals mapper. Verified. |
| H4 | Raw database errors (file paths, query text) returned to users | Information disclosure | `clientErrorMessage` everywhere. |
| H5 | Bank account numbers stored in plaintext and returned by APIs | Bank data exposure | AES-256-GCM at rest (`DATA_ENCRYPTION_KEY`); masked `•••• 1234` everywhere; full number only via audited admin "reveal". Bootstrap encrypts legacy rows. Verified: DB holds ciphertext; APIs return masked/none. |
| H6 | Payouts executed by one person, credits mutated when splitting payouts | Insider fraud, unreconcilable ledger | Maker-checker `PayoutRequest`; ledger amounts immutable (DB trigger); balance derived from ledger; unique bank reference; 72h hold after bank change; limits. Tests: same user can't approve; concurrent requests → one; double approve → one debit. |
| H7 | No MFA for admins/finance | Account takeover = full financial control | TOTP MFA required for every platform role on every admin page and API; recovery codes; CLI reset. Verified live: admin API 403 without MFA, 200 after enrolment. |
| H8 | Rate-limit keys used the client-controlled first `X-Forwarded-For` hop | Brute-force bypass | Proxy-observed IP + per-account limits + 10-failure/15-min lockout. |
| H9 | Admin pages relied on the layout check only | Data exposure on client navigation | Per-page `requireAdminPage` with per-section roles. |
| H10 | Signed COD orders could be "paid"/"failed" by online-payment events; COD key reused as online payment | Order state corruption | Events bound to the order's own online attempt (amount, currency, id); method taken from the order. Tests pass. |

## 3. Medium / low (fixed)

- Customer cancellation didn't restock or return coupon use; seller cancellation released *other* orders' stock reservations.
- COD reconciliation allowed undelivered/cancelled packages to become payable.
- Signature failures returned 500 instead of 401 (provider retry storms).
- Duplicate/foreign return requests; returns before delivery; 20-per-line cart cap bypass.
- Logout via GET (CSRF); no CSRF defence-in-depth → Origin check in `src/proxy.ts` (verified 403 for foreign origin).
- Missing security headers → CSP, HSTS, X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy, COOP (verified present).
- Non-constant-time signature compare on private file links.
- Status codes: business-rule refusals now 400/403/409 instead of 500.
- Dependency advisory: `deepmerge-ts` (Prisma CLI config loader, build-time only) → patched via override; `npm audit --omit=dev` = **0 vulnerabilities**.

## 4–8. Areas reviewed

**Financial transactions.** Prices, discounts, shipping, totals, COD limits are computed server-side in integer paisa; client values are ignored (test: tampered amount/price/coupon fields). Idempotency keys bound to the cart; duplicate submissions return the same order. Prices re-checked inside the order transaction (`PRICE_CHANGED`). Stock reservations atomic with expiry.

**Banking & payouts.** See H5/H6. Bank changes need OWNER/ADMIN + current password (rate-limited re-auth), are recorded in `BankAccountChange` (last 4 only, IP, user agent), notify owners, auto-reject open payouts to the old account, and start a 72h payout hold. Payout limits: Rs 2,000,000 per payout, 1 open request, 3 paid per 24h. Available balance = Σ ledger (ELIGIBLE + SETTLED) − reserved requests; never a stored balance.

**Authentication & authorization.** bcrypt cost 12 with rehash-on-login (OWASP-acceptable alternative to Argon2id; kept to avoid native modules on shared hosting). JWT sessions with `tokenVersion` revocation (password change/reset, "sign out everywhere"), 12h staff sessions, httpOnly/secure/SameSite=Lax cookies. Password reset (30-min single-use hashed tokens, generic responses), email verification (24h), identical responses/timing for unknown email vs wrong password. RBAC enforced server-side for customer, seller (OWNER/ADMIN/CATALOG/FULFILLMENT), support, catalog, finance, super admin; tenant isolation tested.

**Database.** All queries via Prisma (parameterised; the two raw queries use tagged templates). DB triggers: `SettlementLedger` financial columns immutable + no delete; `AuditEvent` insert-only; `Refund` amount immutable + no delete; unique payout reference per seller. Pool capped (Supabase session pooler: 15 clients). The app connects as the database owner role — see remaining risks.

**Fraud & abuse.** Limits in `src/modules/risk/config.ts`: 5 COD orders/24h per phone/email/account, 3 open COD orders per phone, 20 order attempts/hour per IP, coupon once per customer (atomic), no guest COD after 3 customer-cancelled COD orders in 30 days, refund-abuse flag (3 refunded returns in 90 days). Chargebacks recorded with a held seller debit. Everything writes `RISK_*` audit events to the `/admin/risk` review queue; **no automatic fund freezes**.

**Audit logging.** Tamper-resistant (insert-only at the DB level) events for login success/failure/lockout, MFA, password reset, bank changes and reveals, payments, refunds, payouts (request/approve/reject/fail), COD reconciliation, order/return transitions, admin actions, risk flags. Details never include passwords, tokens, or full bank numbers (emails stored as domain + keyed hash in auth events).

## 9. Implemented fixes (files)

Auth: `src/lib/auth.ts`, `src/app/api/auth/**` (`_lib/login.ts`, `mfa.ts`, `tokens.ts`), `src/proxy.ts`, `next.config.ts` (headers), `/account/security`, `/forgot-password`, `/reset-password`, `/verify-email`, `scripts/reset-admin-mfa.ts`.
Banking/payouts: `src/lib/crypto.ts`, `src/modules/sellers/services.ts`, `order-services.ts`, `src/modules/finance/db-guards.ts`, `src/modules/admin/finance.ts`, `api/admin/payouts/**`, `api/seller/profile/bank`, `/admin/payouts`, seller profile & settlements pages.
Payments/fraud: `src/modules/payments/services.ts`, `checkout/services.ts`, `src/modules/risk/**`, `api/webhooks/payments`, `src/lib/jobs`, `/admin/risk`.
Earlier round: order lifecycle, returns state machine, COD reconcile, error sanitisation, role guards.

## 10. Tests & evidence

`npm test` — 8 suites, **611 checks, 0 failures** (local isolated DB):

| Suite | Result | Covers |
| :--- | :--- | :--- |
| business-rules | 199/0 | pricing, stock, checkout, tenancy, settlements |
| catalog-discovery-seo | 74/0 | visibility, metadata, sitemap |
| e2e-functional-audit | 51/0 | customer/seller/admin journeys |
| security-audit-regression | 17/0 | IDOR, cross-tenant, privilege escalation |
| seller-catalog-regression | 43/0 | catalog writes, roles |
| auth-security | 56/0 | revocation, lockout, MFA + replay, reset, CSRF |
| financial-payouts | 72/0 | encryption, masking, bank change, maker-checker, concurrency, DB triggers, reconciliation |
| financial-security | 99/0 | scenarios 1–6, 10, 13–16, fraud rules |

Requested scenarios: 1 ✔ 2 ✔ 3 ✔ 4 ✔ 5 ✔ 6 ✔ 7 ✔ (seller APIs scoped to own org; admin payout routes bound to URL seller) 8 ✔ 9 ✔ (no seller withdrawal endpoint exists; admin-only) 10 ✔ 11 ✔ 12 ✔ 13 ✔ 14 ✔ 15 ✔ 16 ✔ (refund + sandbox chargeback; no live PSP).

Live checks (local server): security headers present; foreign-origin POST → 403; forged webhook → 401; admin API without MFA → 403, with MFA → 200; MFA enrolment issues 10 recovery codes; bank change without password → 400; no full IBAN in seller APIs. Production build with an unreachable database succeeds with **zero** DB calls.

## 11. Remaining risks & external dependencies

- **No live payment provider.** COD only. Integrating a PSP needs its merchant account, sandbox testing, webhook secret, and verification of payment status with the provider API (implemented pattern: signed webhook + reconciliation).
- **Manual bank transfers** for refunds/payouts (no banking API); references are entered by finance. Bank account *ownership* is not verified automatically (no penny-drop/IBAN-title API) — verify with the seller's bank letter during KYC.
- **SMTP not configured** → password reset and verification emails are not delivered in production until it is.
- **Rate-limit store is in-memory** (per process, reset on restart). Fine for one instance; use Redis or the DB if scaled out.
- **CSP keeps `'unsafe-inline'` for scripts** (Next.js inline bootstrap without nonces); `img-src https:` because sellers can link https images.
- **Database role:** the app uses the Supabase owner role. A least-privilege role (no DDL, no TRUNCATE/DELETE on financial tables) would strengthen the triggers; it requires a separate migration role for `db push`.
- **Backups:** rely on Supabase's plan (check PITR on the Supabase dashboard) and Hostinger's daily backup; test a restore.
- **Uploads** are stored on the app disk, which Hostinger replaces on deploy → configure S3/R2 (private bucket for KYC documents, public-read for product images only).
- **Git history** contains development-only secrets (local DB password, dev JWT/cron/webhook values) from an early commit. Production values are different. Rotate the local DB password; consider making the repo private if it isn't.
- **Supabase password** was shared in chat earlier — rotate it and update `DATABASE_URL`.
- **Regulatory:** PDPA-style data-protection obligations and any SBP rules for marketplaces handling customer funds need legal review. Holding customer money and paying sellers may require a licensed payment partner.

## 12. Production deployment security checklist

- [ ] `DATA_ENCRYPTION_KEY` set in Hostinger (from `env.prod`) **and backed up** in a password manager.
- [ ] `JWT_SECRET`, `CRON_SECRET`, `PAYMENT_WEBHOOK_SECRET` set, ≥32 chars, all different (deploy check enforces).
- [ ] `APP_URL=https://wizz.pk`, HTTPS certificate active, `www` redirects to apex.
- [ ] Supabase password rotated; `DATABASE_URL` ends with `connection_limit=5`.
- [ ] First admin sign-in after deploy: enrol two-factor at `/account/security`, store the recovery codes offline. Lockout recovery: `npx tsx scripts/reset-admin-mfa.ts <email> --confirm` on the server.
- [ ] Create a separate `PLATFORM_FINANCE_ADMIN` account (payouts need two different finance users).
- [ ] SMTP configured (`SMTP_HOST/PORT/USER/PASSWORD/FROM`) for reset and verification emails.
- [ ] S3/R2 configured; KYC bucket private.
- [ ] Cron hitting `/api/cron/cleanup` with `CRON_SECRET` (reservations, payment reconciliation, risk scans).
- [ ] Supabase backups/PITR confirmed; one restore tested.
- [ ] `npm audit --omit=dev` clean before each release; `npm test` green.
- [ ] Before enabling any online payment: provider sandbox tests, webhook secret, and a reconciliation run.
