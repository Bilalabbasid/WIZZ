# WIZZ.PK — Project Implementation Plan (PLAN.md)

**Brand Name**: `WIZZ.PK`  
**Domain**: `wizz.pk`  
**Operating Environment**: Next.js 16 (App Router), TypeScript, Tailwind CSS, PostgreSQL, Prisma  
**Market Context**: Pakistan-first English-language multi-seller marketplace (PKR currency, nationwide COD, configurable shipping, tenant isolation)

---

## 1. Project Objectives & Architectural Vision
WIZZ.PK is engineered as a production-grade retail platform operating as a modular monolith. It launches initially as a first-party store (WIZZ.PK Direct as the flagship seller) while embedding the architectural, data-model, and security foundations for third-party sellers to onboard, list products, and fulfill orders without rewriting the core application.

---

## 2. Phased Rollout Roadmap

### Phase A: Launchable WIZZ.PK Store (Active Scope)
- [x] **Storefront Experience**:
  - [x] Responsive layout with header, search, category navigation, cart drawer/page, and footer.
  - [x] Merchandised homepage with featured catalog, category taxonomy, and promotional banners.
  - [x] Product listing catalog with filters (category, price, brand) and URL-persisted search.
  - [x] Product detail view with gallery, variant picker, live stock indicators, seller badge, and specifications.
  - [x] Shopping bag with quantity increment/decrement, item removal, and persistent session/user state.
  - [x] Multi-step/single-page checkout with guest & authenticated support, address collection, coupon validation, and server-side pricing.
  - [x] Customer account portal with order history, shipment tracking, and return requests.
- [x] **Pakistan-First Commerce Engine**:
  - [x] Currency formatting in PKR (`Rs.` / `PKR`) with minor-unit integer precision.
  - [x] Pakistan-compatible addresses (provinces: Punjab, Sindh, KPK, Balochistan, ICT; major cities; postal codes; `+92` phone numbers).
  - [x] Fully functioning **Cash on Delivery (COD)** checkout flow with dedicated courier collection and remittance reconciliation states.
  - [x] Separated sandbox adapter for testing online payments; configuration blueprints for Pakistani payment providers (Safepay, PayFast, Kuickpay).
  - [x] Configurable shipping zones, standard and express charges, free shipping threshold (PKR 3,000+), and COD eligibility.
- [x] **Inventory & Concurrency Protection**:
  - [x] 15-minute transactional inventory reservations during checkout.
  - [x] Atomic stock hold commits upon order completion.
  - [x] Automated background reservation release for abandoned checkouts.
  - [x] Zero overselling enforcement through database-level consistency.
- [x] **Multi-Seller Foundations**:
  - [x] Flagship 1P seller organization (`seller_wizz_pk_1p` — "WIZZ.PK Direct").
  - [x] Customer checkouts partitioned into distinct `SellerOrder` packages with discrete tracking numbers and waybills.
  - [x] Immutable `OrderItem` historical snapshots (title, variant name, SKU, price, seller name).
  - [x] Commission snapshotting and net seller payable calculations.
- [x] **Platform Administration Console**:
  - [x] Product creation and variant inventory editor.
  - [x] Stock adjustment log with auditable reason codes (`CYCLE_COUNT`, `RECEIVING`, `DAMAGE`).
  - [x] Order management and carrier waybill generator (TCS, Leopards, M&P, Trax, PostEx).
  - [x] COD courier cash collection and remittance reconciliation tool.
  - [x] Seller KYC application review pipeline with status transitions and notes.
  - [x] Customer review moderation pipeline.
  - [x] Immutable platform audit event logger.

### Phase B: External Seller Marketplace & Complete Seller Workspace (Fully Implemented & Verified)
- [x] **Schema & Security Foundations**:
  - [x] Multi-tenant data structures (`SellerOrg`, `SellerMembership`, `SellerApplication`, `SellerDocument`, `SellerInvitation`, `Notification`).
  - [x] Server-enforced RBAC and tenant membership checks (`requireSellerMembership`, `verifySellerTenantOwnership`).
  - [x] Strict tenant isolation at all layers: products, inventory, orders, shipments, returns, settlements, and team members.
  - [x] Private KYC document storage outside public image assets with authorized streaming access (`/api/uploads/serve`).
- [x] **External Seller Onboarding & Permission Separation**:
  - [x] Seller registration (`/seller/register`) creates user account and `SellerOrg` in `INACTIVE` state immediately.
  - [x] Sellers can log in immediately and view their dedicated onboarding workspace (`/seller/onboarding`).
  - [x] Server-enforced separation between account access and permission to sell (`DRAFT`, `SUBMITTED`, `CHANGES_REQUESTED`, `APPROVED`, `REJECTED`, `SUSPENDED`).
  - [x] Unapproved merchants can author and save `DRAFT` listings, but the server strictly blocks publishing or accepting orders.
  - [x] Platform admin review console (`/admin/applications`) supports reviewing, requesting changes with feedback notes, approving, rejecting, suspending, and reactivating sellers.
- [x] **Complete Seller Workspace (`/seller/portal`)**:
  - [x] Real-data Seller Dashboard with GMV, net earnings, order counts, catalog health, low-stock alerts, and recent packages.
  - [x] Store Profile management: business identity, legal registration, warehouse pickup address, and bank settlement details.
  - [x] Product management: listing catalog, status filters, search, variant configuration, SKU generator, and image management.
  - [x] Inventory & low-stock view with live balances, active holds, minimum threshold indicators, and stock adjustments with reason codes.
  - [x] Seller-specific orders & fulfillment: partitioned package view, status management, customer shipping details, and courier waybill generator (TCS, Leopards, M&P, Trax, PostEx).
  - [x] Shipment tracking table with live carrier tracking numbers.
  - [x] Return & dispute handling: inspection, approval/rejection notes, and automated inventory restocking.
  - [x] Commission & settlement statements: per-package escrow ledgers, platform fee breakdowns, net payable tracking, and bank account verification.
  - [x] In-app notifications: order alerts, stock warnings, and status updates with mark-as-read functionality.
  - [x] Seller team management: role-based member invitations (`ADMIN`, `OPERATOR`, `FINANCE`), role assignments, and member removal.
  - [x] Store settings & immutable audit trail history.
- [x] **Complete Product Management & Catalog Operations**:
  - [x] Rich Product Editor (`/seller/portal/products/new`, `/seller/portal/products/[id]`): title, slug, category, description, custom key-value specifications (`attributesJson`), and SEO metadata (`metaTitle`, `metaDescription`, Google SERP snippet preview).
  - [x] Multi-Image Manager: progress tracking, drag/sequence reordering, primary thumbnail selector, accessibility alt-text editor, and safe image removal.
  - [x] Variant Combinations Matrix: automated Cartesian product option generator, unique SKU generator, PKR selling price, compare-at promotional price, stock balances, and barcode.
  - [x] Hardened Business Validation: server and client enforcement blocking duplicate SKUs, duplicate option combinations, inverted promotional prices (`compareAtPrice <= price`), and negative stock.
  - [x] Draft Saving & Interactive Live Storefront Preview: allows merchants to preview their listing in customer-facing storefront presentation before submitting.
  - [x] Published Product Revision Staging: server stages edits to live published products in `pendingChangesJson` under `PENDING_REVIEW` so public customers continue viewing approved content until platform admin review.
  - [x] Platform Admin Moderation Workflow (`/api/admin/products/[id]/moderation`): approval, rejection, and change requests with reviewer feedback notes.
  - [x] Bulk Actions Toolbar: atomic batch updates for variant prices and stock balances with real-time validation.
  - [x] CSV Import Engine (`/api/seller/products/import-csv`): documented upsert rules, downloadable template, client-side preview with per-row error diagnostics, dry-run simulation, and tenant-isolated upserts.
- [x] **Testing & Controlled Activation**:
  - [x] 16 end-to-end business rule test suites (`tests/business-rules.test.ts`) covering all 127 assertions with 100% pass rate.
  - [x] Multi-tenant isolation verified with zero cross-tenant leakage across products, inventory, orders, shipments, returns, settlements, team, and CSV imports.
  - [x] Clean Next.js 16 production build (`next build`) with 68 routes successfully compiled.
  - [x] Controlled public activation completed: `FEATURE_SELLER_PORTAL_ACTIVE="true"`, `FEATURE_MARKETPLACE_SETTLEMENTS="true"`.

---

## 3. Progress Tracking & Milestone Completion Checklist

| Milestone | Deliverables | Status | Verification |
| :--- | :--- | :--- | :--- |
| **M1: Discovery & Skills Alignment** | Repository audit, skills installation (`ui-ux-pro-max`), SKILL.md analysis | Completed | 5 skills loaded, CLI tools functional |
| **M2: Design Direction & Tokens** | 3 Visual directions formulated, Direction 1 selected, `DESIGN_SYSTEM.md` authored | Completed | Design tokens in `globals.css` |
| **M3: Pakistan-First Commerce Core** | PKR currency config, Pakistan address schemas, COD flow with reconciliation states | In Progress | Test suite passing, checkout updated |
| **M4: Storefront Visual Realization** | Merchandised homepage, rich product details, high-density catalog, mobile nav. 2026-10-25 polish pass: green brand header, category rail + deals carousel hero, scroll rails, image category tiles, denser product card, 4-column listings | In Progress | `tsc`, `npm test` (333 checks passing), browser check at 375px and 977px. Product detail, cart and checkout not yet restyled |
| **M4b: Seller Center Catalog (2026-10-25)** | Product upload with validated server input, image upload (byte-checked, catalog roles only), formatted descriptions, live price/stock edits with ledger, scheduled deals, review staging for approved listings, list tabs + quick edit + pagination, admin revision summary | Done | `tests/seller-catalog-regression.test.ts` (43 checks) plus existing suites; browser check of list, quick edit, editor deal, upload and storefront price |
| **M5: Administration & Logistics** | Admin catalog, inventory log, courier dispatch, COD remittance tool | In Progress | Route Handlers & Server Components verified |
| **M6: Verification & Hardening** | 11 Domain test suites, build check, Turbopack bundle trace optimization | Pending | `npm test` & `npm run build` |

---

## 4. Known Blockers & External Requirements
0. **Seed catalog imagery**: Several seeded products show photos that do not match the product (e.g. a handbag on a knife listing, a keyboard on a wrist rest), and one product image URL (LuminaCraft storage basket) returns 404. Storefront now shows a placeholder for failed images, but real product photography is needed before launch.
1. **Live Payment Gateway Credentials**: Online payment processing currently utilizes the sandboxed local development adapter. Live payment with Pakistani providers (Safepay, PayFast, Kuickpay) requires merchant account registration, API keys, and webhook endpoints configured in `.env`.
2. **Object Storage**: Local file storage is utilized in development (`.uploads/`). Production deployment requires S3-compatible credentials (AWS S3, Cloudflare R2, or MinIO).
