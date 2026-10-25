# WIZZ.PK — Architectural Blueprint (ARCHITECTURE.md)

**System Type**: Modular Monolith  
**Runtime**: Next.js 16 (App Router), Node.js, TypeScript  
**Database**: PostgreSQL with Prisma ORM  
**Security & Auth**: Jose JWT with httpOnly secure cookies, role-based access control, tenant isolation  
**Deployment Target**: Cloud/Container (Node.js standalone or serverless)

---

## 1. Domain Modules & Architectural Boundaries

WIZZ.PK is structured as a modular monolith where domain logic is encapsulated inside server-side services (`src/modules/*`), consumed identically by Route Handlers (`src/app/api/*`) and Server Components/Actions:

```
src/
├── app/                  # Presentation Layer (Next.js App Router)
│   ├── (storefront)/     # Public shopping routes (Home, Products, Cart, Checkout, Orders)
│   ├── (admin)/          # Platform admin workspace (/admin, /admin/products, /admin/orders...)
│   ├── (seller)/         # Merchant onboarding and status (/seller, /seller/onboarding)
│   └── api/              # HTTP Route Handlers with Zod validation
├── modules/              # Domain Business Services
│   ├── catalog/          # Products, categories, brands, variants, media
│   ├── inventory/        # Atomic stock management, 15-min reservations, adjustments
│   ├── cart/             # Concurrency-safe cart items and session sync
│   ├── checkout/         # Server-side pricing, tax/shipping allocation, order generation
│   ├── orders/           # Customer orders, immutable snapshots, cancellation
│   ├── payments/         # Payment provider adapter boundary, COD, webhooks
│   ├── fulfillment/      # Carrier waybill generation, shipment tracking checkpoints
│   ├── returns/          # Return authorization, inspection, restocking, refunds
│   ├── reviews/          # Verified purchase reviews, moderation pipeline
│   └── sellers/          # Seller KYC onboarding, memberships, multi-tenant boundaries
└── lib/                  # Infrastructure & Shared Utilities
    ├── auth.ts           # Authentication tokens, session decoding, RBAC checks
    ├── config.ts         # Centralized platform and regional configuration
    ├── db.ts             # Prisma database client singleton
    ├── flags.ts          # Server-enforced feature flags
    └── formatters.ts     # Locale-aware PKR currency & date formatters
```

---

## 2. Multi-Seller Data Architecture & Financial Accuracy

### 2.1 Single Checkout $\rightarrow$ Multi-Seller Partitioning
A single customer checkout session with items from multiple sellers creates:
1. One root **`CustomerOrder`**: The customer-facing master order recording total amount paid/due, shipping address, coupon code, and overall order status.
2. One or more **`SellerOrder`** packages: Exactly one sub-order per unique `sellerOrgId`.
3. Immutable **`OrderItem`** snapshots: Each line item captures `productTitleSnapshot`, `variantNameSnapshot`, `skuSnapshot`, `unitPriceMinorSnapshot`, `sellerNameSnapshot`, and `commissionRatePercent`. Subsequent catalog price or product changes never modify historical orders.

### 2.2 Financial Arithmetic (Minor Units)
- **Zero Floating-Point Arithmetic**: All monetary quantities (`unitPriceMinor`, `subtotalMinor`, `discountMinor`, `shippingMinor`, `taxMinor`, `totalMinor`, `netSellerPayableMinor`) are strictly stored as integers representing minor currency units (e.g. 100 paisas = 1 PKR, Rs. 2,499.00 = `249900` minor units).
- **Proportional Allocation**: Discounts, taxes, and shipping are authoritatively allocated across seller suborders proportionally based on subtotal weight, with exact rounding reconciliations ensuring `sum(sellerOrders) == customerOrder.total`.

---

### 2.3 Seller Catalog: Publishing, Price Edits & Scheduled Deals
Implemented in `src/modules/sellers/catalog-services.ts` and `deal-pricing.ts`; all seller routes resolve the store from the caller's membership (`api-guard.ts`), and catalog writes require the OWNER, ADMIN or CATALOG_MANAGER role.

- **Publishing**: External sellers cannot publish directly. "Submit for review" sets `moderationStatus = PENDING_REVIEW`; an admin approval sets `PUBLISHED` + `isApprovedByPlatform`. WIZZ.PK Direct (first party) publishes immediately. A listing needs a description and at least one image to be submitted.
- **Live vs reviewed changes**: Price, "was" price, deal, cost, stock, low-stock alert, variant on/off and removing variants apply immediately. Content (title, description, images, category, brand, specs, SEO, variant names/SKUs, new variants) of an approved external listing is staged in `pendingChangesJson` and applied only on approval; shoppers keep seeing the approved version.
- **Stock edits** are applied as a delta from the value the seller loaded (`stockBaseline`), recorded in `InventoryAdjustment`, and can never go below `reservedUnits`.
- **Removed variants** are deactivated, never deleted, so order history keeps its references; re-adding the SKU revives the same variant.
- **Scheduled deals**: `priceMinor` is always what the shopper pays now. While a deal is live, `priceMinor = dealPriceMinor`, `compareAtPriceMinor` = the regular price, and the seller's own values sit in `dealRegularPriceMinor` / `dealRegularCompareAtMinor`. `syncDealPricing()` applies start/end transitions on every maintenance tick and for the cart's variants at the start of checkout, so the charged price always matches the deal window. Price edits during a deal change the regular price.

## 3. Inventory Concurrency & Zero Overselling Protection

1. **15-Minute Reservation Window**: Adding items to checkout or beginning order placement creates an `InventoryReservation` record with `expiresAt = now() + 15 minutes`.
2. **Net Sellable Stock Formula**:
   $$\text{Sellable Stock} = \max(0, \text{availableUnits} - \text{reservedUnits})$$
3. **Commitment vs. Release**:
   - When an order is placed (COD or paid online), active reservations are committed (`ReservationStatus.COMMITTED`) and `availableUnits` is atomically decremented.
   - If a checkout is abandoned or expires, background cleanup jobs (`/api/cron/cleanup`) transition reservations to `EXPIRED` and restore the sellable balance.

---

## 4. Cash on Delivery (COD) Lifecycle & Reconciliation

In a Pakistan-first marketplace, Cash on Delivery is the predominant consumer payment method. To prevent financial distortion and inaccurate reporting, WIZZ.PK enforces strict reconciliation states:

```
[Order Placed (COD)] 
       │ 
       ▼ 
Status: PROCESSING | Payment: UNPAID | Stock: COMMITTED
       │ 
       ▼ (Merchant dispatches parcel)
Status: SHIPPED | Payment: UNPAID (Crucial: Delivery != Payment)
       │ 
       ▼ (Courier delivers package to customer)
Status: DELIVERED | Payment: UNPAID | Courier Cash Collected
       │ 
       ▼ (Admin reconciles courier cash remittance statement)
Status: DELIVERED | Payment: PAID | Audit: COD_REMITTED
```

- **Safety Rule**: Shipping or delivering an order NEVER automatically marks it as `PAID`.
- **Administrative Reconciliation**: The Platform Admin Orders Console provides a dedicated "Reconcile COD Remittance" action requiring courier remittance slip details, updating `paymentStatus = PAID` and logging an immutable `AuditEvent`.

---

## 5. Security & Tenant Isolation Model

1. **Server-Enforced RBAC**:
   - `PLATFORM_SUPER_ADMIN`: Full platform governance.
   - `CUSTOMER`: Standard shopping access.
   - `SELLER_MEMBERSHIP`: Tenant-scoped access strictly validated against `sellerOrgId`.
2. **Tenant Data Isolation**:
   - Seller A cannot view, edit, or list Seller B's inventory, orders, customers, or financial records.
   - Customer orders containing multiple sellers only present the specific seller's suborder package to that merchant.
3. **Input Validation**: All client inputs across Route Handlers and Server Actions pass through Zod schemas.
4. **Audit Logs**: Critical administrative actions (inventory adjustments, seller application approvals, review moderation, COD remittance) write append-only records to `AuditEvent`.
