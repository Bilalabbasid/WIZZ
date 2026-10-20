# WIZZ.PK — Product Requirements Document (PRD)

## 1. Executive Summary & Brand Identity
**WIZZ.PK** is a modern, high-trust e-commerce platform engineered from the ground up as a robust first-party (1P) retail storefront that gracefully scales into an enterprise multi-seller (3P) marketplace.

- **Brand Name**: `WIZZ.PK` (Preserved strictly across all interfaces, transactional comms, and documentation).
- **Default Locale & Language**: English (`en-US`).
- **Canonical Production URL**: Configurable via `NEXT_PUBLIC_APP_URL` / `APP_URL`.
- **Localization & Commerce Config**: Country, currency (`USD` default, minor-unit integer storage), shipping zones, tax rates, payment methods, and business contact points are strictly configurable via environment variables and administrative commerce settings.
- **Product Type**: Physical merchandise initially, supported by an extensible category hierarchy, custom variant attributes, and dimensional logistics specs.

---

## 2. Platform Rollout Phases & Feature Flags

| Stage | Scope | Implementation Status | Server-Side Feature Flag |
| :--- | :--- | :--- | :--- |
| **Stage 1** | **WIZZ.PK Flagship Storefront + Seller Onboarding**<br>• Full customer shopping journey (browse, search, cart, checkout, orders, reviews, wishlist).<br>• Platform Administration (catalog, inventory, orders, customers, reviews, audit logs).<br>• Seller Application System ("Sell on WIZZ.PK", multi-step onboarding, document verification, review workflow). | **Active (Target of Current Delivery)** | Enabled |
| **Stage 2** | **Approved External Seller Operations**<br>• External seller portal (store profile, listing authoring, variant management, stock tracking).<br>• Seller-specific order fulfillment and dispatch tracking. | **Schema & Service Boundaries Ready; Flag-Gated** | `FEATURE_SELLER_PORTAL_ACTIVE` (Server-enforced) |
| **Stage 3** | **Marketplace Settlement & Advanced Financials**<br>• Commission calculations, automated seller ledgers, payout integrations.<br>• Formal dispute mediation and multi-party escrow/settlement reconciliations. | **Schema & Ledger Entities Designed; Flag-Gated** | `FEATURE_MARKETPLACE_SETTLEMENTS` (Server-enforced) |

---

## 3. User Personas & Core Journeys

### 3.1 The Customer (Guest & Registered)
- **Discovery**: Responsive storefront with dynamic hero/promotional carousels, nested categories, instant keyword search, and multi-facet filtering (price range, category, availability).
- **Product Details**: High-resolution gallery, real-time stock indicator, dynamic variant selection (size, color, spec), explicit seller badge, transparent shipping and return policies.
- **Cart & Wishlist**: Persistent cart, optimistic updates, stock reservation preview, item saving to wishlist.
- **Checkout**: Guest checkout or authenticated customer account checkout. Server-side recalculation of line totals, configurable shipping tiers, sales taxes, and coupon application.
- **Account & Orders**: Secure customer portal with address book, order history, live shipment tracking checkpoints, cancellation requests (prior to dispatch), and verified-purchase review submission.

### 3.2 The Platform Administrator (WIZZ.PK Staff)
- **Role-Based Governance**: Granular permissions distinguishing Catalog Admins, Order/Fulfillment Managers, Support Agents, Finance Admins, and Platform Super Admins.
- **Storefront Management**: Banner configuration, featured category curation, brand profiles, and policy text editing (Terms, Privacy, Shipping, Returns).
- **Product & Inventory Operations**: Direct management of WIZZ.PK 1P inventory, product creation with multi-variant SKUs, audit logs of manual stock adjustments.
- **Seller Application Pipeline**: Dedicated workspace to inspect submitted seller applications, view uploaded KYC documents, request changes with structured feedback notes, approve, or reject applicants.
- **Order & Fulfillment Control**: Order oversight across all states, payment verification, shipment generation with tracking details, refund processing, and dispute handling.

### 3.3 The Seller Applicant & Organization Member
- **Onboarding Workspace**: Seamless "Sell on WIZZ.PK" flow. Multi-step draft persistence covering store identity, business registration, contact details, warehouse pickup/return address, and KYC document uploads.
- **Status Transparency**: Real-time status tracker (`draft`, `submitted`, `under_review`, `changes_requested`, `approved`, `rejected`) with administrative feedback threads.
- **Access Gating**: Applicants log in securely to track application status. Direct catalog publishing and order reception are hard-locked on the backend until administrative approval and operational activation (`active`).

---

## 4. Key Functional Requirements

### 4.1 Marketplace Organization & Listing Ownership
1. **First-Party Seller**: The platform automatically seeds `WIZZ.PK` as the flagship Seller Organization (`id: seller_wizz_pk_1p`).
2. **Explicit Listing Ownership**: Every product and variant belongs strictly to a `sellerOrgId`.
3. **Decoupled User Accounts**: Users hold platform identity. A user may be an independent buyer while holding memberships (`OWNER`, `ADMIN`, `CATALOG_MANAGER`, `FULFILLMENT`) in one or more seller organizations.
4. **Independent Listings**: Listings are seller-specific, enforcing SKU uniqueness within each seller's catalog.

### 4.2 Concurrency-Safe Inventory & Reservation Engine
1. **Zero Overselling**: Transactions utilize atomic database operations and row-level locking (`SELECT ... FOR UPDATE` or Prisma interactive transactions).
2. **Checkout Reservation Window**: Adding items to checkout creates a temporary inventory reservation (configurable, default 15 minutes) with an expiration timestamp.
3. **Reservation Expiration Handling**: Expired reservations are automatically released by background maintenance jobs. If a late payment succeeds after reservation expiration, the system flags the order for admin review or triggers an automated refund rather than silently fulfilling non-existent stock.

### 4.3 Financial Representation & Calculations
1. **Minor Unit Integer Precision**: All monetary values (prices, discounts, taxes, shipping, totals) are stored as integers representing minor currency units (e.g., USD cents `$29.99` $\rightarrow$ `2999`). Floating-point arithmetic is forbidden.
2. **Server-Authoritative Totals**: The client never calculates payable amounts. Line items, shipping rates, promotional discounts, and taxes are recalculated and verified strictly by backend services.
3. **Multi-Seller Order Breakdown**:
   - `CustomerOrder`: Represents the master order for the buyer.
   - `SellerOrder`: Deconstructed sub-orders allocated to each seller organization.
   - `OrderItem`: Contains immutable historical snapshots (`productTitleSnapshot`, `variantNameSnapshot`, `skuSnapshot`, `unitPriceMinorSnapshot`, `taxMinorSnapshot`, `discountMinorSnapshot`). Catalog modifications never alter historical order items.

### 4.4 Payments & Webhooks
1. **Abstracted Provider Interface**: Clean interface supporting production gateways (Stripe, PayPal, Adyen) alongside a sandboxed local development adapter.
2. **Server-Side Verification**: Orders are never transitioned to `PAID` based on browser URL redirects. Only verified, signed webhook events or direct server-to-server gateway confirmations trigger state transitions.
3. **Webhook Idempotency**: All incoming webhook events are recorded with event IDs to guard against replay attacks and duplicate deliveries.

---

## 5. Non-Functional & Security Requirements
1. **Authorization**: Strict role-based access control (RBAC) and tenant isolation enforced at the service and data-access layer.
2. **Input Validation**: Strict Zod schemas validating all client inputs on API routes and Server Actions.
3. **Private Document Storage**: Seller KYC documents and business records reside in private S3/local object storage accessible solely via short-lived signed URLs.
4. **Audit Logging**: Sensitive actions (role changes, application decisions, inventory adjustments, refunds) write immutable audit logs containing user ID, IP address, timestamp, and diff snapshots.
5. **SEO & Performance**: Server-side rendering (SSR), dynamic OpenGraph metadata, JSON-LD Schema.org product structured data, XML sitemap generation, and optimized Core Web Vitals.
