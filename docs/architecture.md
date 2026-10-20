# WIZZ.PK — System Architecture & Modular Monolith Design

## 1. Architectural Philosophy
WIZZ.PK is designed as a **Modular Monolith** using Next.js App Router (TypeScript) and PostgreSQL. It enforces clean separation of concerns without the operational complexity and distributed failure modes of early microservices.

### Key Architectural Tenets
1. **Domain Boundaries**: The system is organized into decoupled domain modules located under `src/modules/<domain>`.
2. **Service Layer Isolation**: Domain logic resides exclusively inside domain services (`src/modules/<domain>/services`). Route handlers and Server Actions act purely as thin entry points handling HTTP transport, input parsing, session extraction, and response formatting.
3. **Database Single-Source-of-Truth**: All persistent state resides in PostgreSQL managed by Prisma with versioned migrations.
4. **Resilient Background Execution**: Durable operations (email dispatch, image optimization, batch imports, reservation cleanup, scheduled reconciliation) are scheduled via an atomic database-backed job runner.
5. **No Blind Trust**: Client-side totals, permissions, and entity associations are never trusted. All calculations and access controls are server-enforced.

---

## 2. Directory Structure & Domain Topology

```
wizz.pk/
├── docs/                               # Core engineering documentation
├── prisma/
│   ├── schema.prisma                   # Normalized marketplace data schema
│   ├── migrations/                     # Versioned SQL migrations
│   └── seed.ts                         # Deterministic development seed dataset
├── src/
│   ├── app/                            # Next.js App Router
│   │   ├── (storefront)/               # Customer-facing shopping journeys
│   │   │   ├── page.tsx                # Dynamic homepage
│   │   │   ├── products/               # Category & Product detail pages
│   │   │   ├── search/                 # Instant facet search & filter
│   │   │   ├── cart/                   # Real-time cart & reservation summary
│   │   │   ├── checkout/               # Multi-step checkout & payment
│   │   │   ├── orders/                 # Customer order history & tracking
│   │   │   ├── account/                # Profile, addresses, wishlist
│   │   │   ├── policies/               # Shipping, returns, terms, privacy
│   │   │   └── sell/                   # "Sell on WIZZ.PK" onboarding landing
│   │   ├── (seller)/                   # Seller application & portal workspace
│   │   │   └── seller/onboarding/      # Draft application & KYC submission
│   │   ├── (admin)/                    # Platform administration dashboard
│   │   │   └── admin/                  # Catalog, orders, sellers, audit logs
│   │   └── api/                        # REST & Webhook endpoints
│   │       ├── webhooks/payment/       # Idempotent signed payment webhook
│   │       ├── cron/cleanup/           # Scheduled maintenance trigger
│   │       └── uploads/                # Media & document upload handler
│   ├── components/                     # Reusable UI component library (design system)
│   ├── lib/                            # Shared utilities (db, storage, jobs, auth, config)
│   │   ├── db.ts                       # Prisma client singleton
│   │   ├── auth.ts                     # Session & token verification
│   │   ├── storage/                    # S3 & Local object storage adapter
│   │   ├── jobs/                       # Durable database job queue worker
│   │   └── flags.ts                    # Server-side feature flag evaluation
│   └── modules/                        # Domain business logic (Modular Monolith)
│       ├── identity/                   # Users, auth, roles, sessions
│       ├── sellers/                    # SellerOrgs, applications, KYC, onboarding
│       ├── catalog/                    # Categories, brands, products, variants
│       ├── inventory/                  # Stock levels, reservations, adjustments
│       ├── cart/                       # Session cart, line items, stock validation
│       ├── checkout/                   # Price recalculation, coupon engine, tax/shipping
│       ├── orders/                     # Customer orders, seller orders, immutable snapshots
│       ├── payments/                   # Provider adapter (Sandbox, Stripe), webhooks
│       ├── fulfillment/                # Shipments, package tracking, dispatch
│       ├── returns/                    # Return authorizations, inspection, refunds
│       ├── commissions/                # (Stage 3 ready) Fee structures & ledgers
│       └── reporting/                  # Metrics, KPIs, audit log aggregation
```

---

## 3. Domain Modules & Service Responsibilities

### 3.1 `identity` Module
- **Entities**: `User`, `Session`, `Address`, `PasswordResetToken`
- **Capabilities**: Secure registration, argon2/bcrypt password hashing, stateless or database-backed session tokens, multi-role assignment (`SUPER_ADMIN`, `CATALOG_ADMIN`, `FINANCE_ADMIN`, `CUSTOMER`).

### 3.2 `sellers` Module
- **Entities**: `SellerOrg`, `SellerMembership`, `SellerApplication`, `ApplicationEvent`, `SellerDocument`
- **Capabilities**: Multi-tenant seller organizations. `WIZZ.PK` is initialized as the primary 1P seller org (`id: seller_wizz_pk_1p`). Handles applicant onboarding (`DRAFT` $\rightarrow$ `SUBMITTED` $\rightarrow$ `UNDER_REVIEW` $\rightarrow$ `CHANGES_REQUESTED` $\rightarrow$ `APPROVED` / `REJECTED`), administrative review notes, and operational status gating (`INACTIVE`, `ACTIVE`, `SUSPENDED`).

### 3.3 `catalog` Module
- **Entities**: `Category`, `Brand`, `Product`, `ProductVariant`, `ProductAttribute`, `ProductMedia`
- **Capabilities**: Hierarchical category tree, rich variant matrices (color, size, material), media galleries, SEO slugs, seller-specific listing ownership, and SKU validation.

### 3.4 `inventory` Module
- **Entities**: `InventoryLevel`, `InventoryReservation`, `InventoryAdjustment`
- **Capabilities**:
  - Atomic stock validation using transactional queries.
  - Temporary 15-minute stock reservations during checkout to prevent overselling.
  - Concurrency-safe decrement upon payment confirmation.
  - Audit trail of stock adjustments with reason codes (`RECEIVING`, `DAMAGE`, `COUNT_CORRECTION`, `SALE`).

### 3.5 `cart` & `checkout` Modules
- **Entities**: `Cart`, `CartItem`, `Coupon`, `PromotionAllocation`
- **Capabilities**:
  - Guest and authenticated user cart synchronization.
  - Server-authoritative price recalculation (never trust client amounts).
  - Deterministic allocation of discounts, taxes, and shipping rates.
  - Idempotent checkout initiation preventing duplicate submissions.

### 3.6 `orders` & `fulfillment` Modules
- **Entities**: `CustomerOrder`, `SellerOrder`, `OrderItem`, `Shipment`, `ShipmentEvent`
- **Capabilities**:
  - Multi-seller order hierarchy (`CustomerOrder` has many `SellerOrder`s).
  - Snapshotting: Each `OrderItem` freezes product title, SKU, seller name, unit price, tax, discount, and commission terms. Catalog updates never corrupt order history.
  - Fulfillment tracking: Waybill numbers, carrier assignments, and milestone tracking updates.

### 3.7 `payments` Module
- **Entities**: `PaymentAttempt`, `WebhookEvent`
- **Capabilities**:
  - Generic `IPaymentProvider` abstraction.
  - Local sandboxed test payment gateway for automated testing and staging environments.
  - Idempotent webhook processor tracking external transaction IDs to prevent double credits.
  - Orders are only transitioned to `PAID` via verified backend webhooks or server-to-server confirmation.

---

## 4. Background Job Architecture
To avoid unreliability from fragile in-process timers, the system implements a robust, database-backed job engine:
1. **Queue Model**: Table `BackgroundJob` records `jobType`, `payloadJson`, `status` (`PENDING`, `RUNNING`, `COMPLETED`, `FAILED`), `scheduledAt`, `retryCount`, `maxRetries`, and `lastError`.
2. **Worker Process**: Polling worker with transactional locking (`UPDATE ... WHERE status = 'PENDING' AND scheduledAt <= NOW() LIMIT 1 RETURNING ...`) prevents race conditions across instances.
3. **Tasks**:
   - `CLEANUP_EXPIRED_RESERVATIONS`: Releases held stock when checkout timers expire.
   - `SEND_TRANSACTIONAL_EMAIL`: Order receipts, seller status updates, customer password resets.
   - `PROCESS_SELLER_APPLICATION_NOTIFICATION`: Alerts admins of newly submitted applications.
   - `INDEX_CATALOG_SEARCH`: Updates search indices upon product changes.

---

## 5. Storage Strategy
Media and uploaded documents use an abstract `IStorageProvider`:
- **Development**: Local disk storage under `.uploads/` served via an authenticated streaming endpoint with access control.
- **Production**: S3-compatible object storage (AWS S3, MinIO, Cloudflare R2).
- **Security**: Public product media is served via CDN, while seller KYC compliance documents are strictly kept in private buckets and accessed only via short-lived signed URLs generated for verified admins.
