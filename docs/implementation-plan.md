# WIZZ.PK — Implementation Plan & Phase Tracking

## 1. Project Phase Tracker

| Phase | Description | Status |
| :--- | :--- | :---: |
| **Phase 1** | Foundation: Next.js App Router, Tailwind CSS, PostgreSQL + Prisma Schema | In Progress |
| **Phase 2** | Domain Architecture & Services (Modular Monolith) | Next |
| **Phase 3** | Brand Design System & Accessible Component Library | Queued |
| **Phase 4** | Customer Storefront Journeys (Browse, Search, Product, Cart, Checkout, Orders) | Queued |
| **Phase 5** | Seller Onboarding System ("Sell on WIZZ.PK", KYC, Status Tracking, Review) | Queued |
| **Phase 6** | Platform Administration Portal (Catalog, Applications, Orders, Audit Logs) | Queued |
| **Phase 7** | Payments, Webhook Verification & Durable Background Job Queue | Queued |
| **Phase 8** | Integration & End-to-End Test Suite (Playwright & Business Rule Tests) | Queued |

---

## 2. Detailed Task Breakdown

### Phase 1: Foundation & Database
- [x] Create project documentation (`docs/product-requirements.md`, `docs/architecture.md`, `docs/data-model.md`, `docs/permissions.md`).
- [ ] Install core dependencies (`@prisma/client`, `prisma`, `zod`, `bcryptjs`, `jose`, `lucide-react`).
- [ ] Write normalized Prisma schema with PostgreSQL models for Users, SellerOrgs, Products, Variants, Inventory, Carts, Orders, Payments, Shipments, Reviews, and Jobs.
- [ ] Run versioned database migration creating database tables in PostgreSQL `wizz_pk`.
- [ ] Create deterministic database seed (`prisma/seed.ts`) populating:
  - WIZZ.PK 1P Seller Org (`seller_wizz_pk_1p`).
  - Platform Super Admin (`admin@wizz.pk`).
  - Sample customer (`customer@wizz.pk`).
  - Sample seller applicant (`applicant@craftgear.com`).
  - Flagship product catalog (categories, brands, products, multi-variant SKUs, inventory levels).

### Phase 2: Domain Services (Modular Monolith)
- [ ] `src/modules/identity/services`: User registration, authentication, session tokens, password verification, address book.
- [ ] `src/modules/sellers/services`: Seller application submission, multi-step draft persistence, status transitions, review notes, seller org activation.
- [ ] `src/modules/catalog/services`: Category tree querying, product listing with filters, full-text keyword search, variant retrieval.
- [ ] `src/modules/inventory/services`: Concurrency-safe inventory reservation engine, stock decrement, adjustment audit logs.
- [ ] `src/modules/cart/services`: Session-based and user carts, quantity validation, stock check.
- [ ] `src/modules/checkout/services`: Authoritative server calculation, coupon engine, tax/shipping allocation, order generation.
- [ ] `src/modules/orders/services`: Customer order retrieval, immutable line item snapshotting, cancellation rules, tracking checkpoints.
- [ ] `src/modules/payments/services`: Sandboxed test payment adapter, signed webhook processor with idempotency checks.
- [ ] `src/modules/fulfillment/services`: Waybill creation, tracking updates, dispatch status transitions.
- [ ] `src/modules/returns/services`: Return request submission, admin evaluation, restocking workflow.

### Phase 3: Brand Design System
- [ ] Setup cohesive design tokens in Tailwind CSS:
  - Brand Palette: Midnight Slate (`#0B0F19`), Electric Indigo (`#4F46E5`), Emerald Green (`#059669`), Warm Amber (`#D97706`), Off-White Canvas (`#F9FAFB`).
  - Modern typography and fluid scale.
- [ ] Build reusable UI components: Button, Input, Select, Badge, Card, Modal, Table, Toast, RatingStars, Breadcrumbs.

### Phase 4: Customer Storefront Experience
- [ ] Responsive Header with search bar, category flyout, cart badge, and user navigation.
- [ ] Dynamic Homepage: Hero promotional banner, featured categories, trending products, value proposition guarantees.
- [ ] Catalog Browsing (`/products`, `/categories/[slug]`): Filters (price, category, availability), sorting, pagination.
- [ ] Product Detail Page (`/products/[slug]`): Image gallery, variant selectors, stock badge, seller badge, shipping/returns policies.
- [ ] Shopping Cart (`/cart`): Quantity controls, stock hold notices, order summary.
- [ ] Checkout (`/checkout`): Multi-step guest/account checkout, address entry, shipping selector, coupon field, payment simulator.
- [ ] Order Confirmation & History (`/orders/[id]`): Order snapshot, shipment timeline, verified review submission button.
- [ ] Customer Account (`/account`): Profile, address management, wishlist.
- [ ] Public Informational Pages: About WIZZ.PK, Shipping Policy, Return Policy, Terms of Service, Privacy Policy, Contact Us.

### Phase 5: Seller Onboarding System
- [ ] "Sell on WIZZ.PK" landing page (`/sell`).
- [ ] Multi-step seller onboarding workspace (`/seller/onboarding`):
  - Step 1: Store identity & trading name.
  - Step 2: Legal business registration & tax IDs.
  - Step 3: Contact person & warehouse addresses.
  - Step 4: KYC document uploads.
  - Step 5: Terms acceptance & submission.
- [ ] Real-time status tracker (`draft`, `submitted`, `under_review`, `changes_requested`, `approved`, `rejected`) with feedback notes.

### Phase 6: Platform Administration Portal
- [ ] Admin layout (`/admin`) with secure role authentication.
- [ ] Executive Dashboard: Key metrics (revenue, orders, active listings, pending applications).
- [ ] Seller Application Review: Detail view, KYC document links, feedback dialogue, Approve/Reject buttons.
- [ ] 1P Catalog Management: Add/edit products, manage variants, upload images, update categories.
- [ ] Inventory Management: Live stock table, manual stock adjustment with audit reasons.
- [ ] Order Management: Fulfillment updates, dispatch tracking entry, cancellation/refund actions.
- [ ] Audit Log Viewer: Immutable log of all administrative actions.

### Phase 7: Background Jobs & Payments
- [ ] Database-backed resilient job worker (`src/lib/jobs`).
- [ ] Webhook route (`/api/webhooks/payment`) with signature verification and replay protection.
- [ ] Expired reservation cleanup runner.

### Phase 8: Testing & Verification
- [ ] Playwright E2E tests: Customer journey (browse $\rightarrow$ cart $\rightarrow$ checkout $\rightarrow$ order receipt).
- [ ] Seller application journey test: Submission $\rightarrow$ Admin Review $\rightarrow$ Feedback $\rightarrow$ Approval.
- [ ] Unit & integration tests for:
  - Inventory concurrency and zero-overselling.
  - Server calculation integrity (tamper-proof totals).
  - Role-based permissions & tenant isolation (Seller A cannot access Seller B).
  - Webhook idempotency.
