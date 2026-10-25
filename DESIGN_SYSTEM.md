# WIZZ.PK — Design System & Visual Directions (DESIGN_SYSTEM.md)

**Brand Identity**: `WIZZ.PK` (domain: `wizz.pk`)  
**Design Intelligence**: Guided by `frontend-design`, `ui-ux-pro-max`, `storefront-best-practices`, and `web-design-guidelines`.

---

## 1. Visual Direction Exploration

To ensure WIZZ.PK avoids generic AI/SaaS-style defaults (oversized heroes, pastel blobs, identical rounded cards, and repeating 3-icon blocks), three distinct visual directions tailored for a high-trust commerce marketplace were developed and evaluated:

### Direction 1: "Raw Commercial / High-Street Modernist" (RECOMMENDED & SELECTED)
- **Concept**: A high-utility, high-clarity retail identity built for serious merchandise discovery, rapid conversion, and dense product inspection. Clean white/pearl canvas with deep charcoal contrasts and high-energy emerald/volt functional accents.
- **Typography**:
  - Primary UI & Data: `Plus Jakarta Sans` — punchy geometric grotesque with high legibility at micro-sizes, wide aperture, and clean tabular figures for PKR prices.
  - Display/Headings: `Plus Jakarta Sans` (Extrabold 800/900) for authoritative retail hierarchy.
- **Color System**:
  - Base Background: `#F8FAFC` (Canvas), `#FFFFFF` (Surface Cards)
  - Primary Text: `#0F172A` (Slate 900)
  - Muted Text: `#64748B` (Slate 500)
  - Brand Primary / Action: `#059669` (Emerald 600) with `#047857` (Hover)
  - Accent / Urgency: `#EA580C` (Amber/Orange 600) for sale badges and low-stock indicators
  - Border System: `#E2E8F0` (Slate 200) with refined 1px strokes
- **Product-Image Treatment**:
  - Consistent 1:1 square ratio with neutral `#F1F5F9` backing.
  - Crisp subtle hover zoom (1.04x) with hardware-accelerated transitions.
  - Zero decorative drop-shadow blur blobs; crisp functional card boundary.
- **Navigation & Search**:
  - Top utility announcement banner for shipping and merchant links.
  - Prominent search input centered in the header with instant category pills below.
  - Live cart icon with `aria-live="polite"` badge counter.
- **Product-Card Density**:
  - Balanced 4-column desktop grid (2 columns on mobile) displaying product title, category, seller identity ("WIZZ.PK Direct"), PKR price with strike-through comparison, and honest stock status.

### Direction 2: "Nordic Minimalist Bazaar"
- **Concept**: High-whitespace, subdued luxury retail aesthetic focusing on lifestyle imagery and editorial typography.
- **Typography**: `Inter Display` paired with `Instrument Serif` editorial italics.
- **Color System**: `#FAF7F2` warm sand canvas, `#1C1917` warm espresso text, `#CA8A04` ochre accent.
- **Product-Image Treatment**: 3:4 portrait aspect ratios with expansive borders and soft lighting.
- **Why Not Selected**: While elegant, it lowers catalog density, is less suited to multi-category electronics/hardware merchandise, and reads more like an indie boutique than an authoritative Pakistan-wide marketplace.

### Direction 3: "Tech-Forward Hyper-Retail"
- **Concept**: Dark-mode heavy, spec-sheet aesthetic with neon accents and high data density.
- **Typography**: `Sora` or `Space Grotesk` with monospace spec chips.
- **Color System**: `#0B0F19` obsidian background, `#2563EB` royal cobalt, `#10B981` cyber green.
- **Product-Image Treatment**: High-contrast floating cutouts with neon glow backdrops.
- **Why Not Selected**: Pure dark-mode interfaces alienate mainstream daylight mobile shoppers and introduce contrast fatigue across multi-seller catalog listings.

---

## 2. Core Design Tokens (Direction 1)

### 2.1 CSS Variables & Palette Tokens
```css
:root {
  /* Canvas & Surfaces */
  --bg-canvas: #f8fafc;
  --bg-card: #ffffff;
  --bg-elevated: #ffffff;
  --bg-subtle: #f1f5f9;

  /* Typography / Foreground */
  --text-main: #0f172a;
  --text-muted: #64748b;
  --text-subtle: #94a3b8;
  --text-inverse: #ffffff;

  /* Brand & Status Colors */
  --brand-primary: #059669;       /* WIZZ Emerald */
  --brand-primary-hover: #047857;
  --brand-accent: #ea580c;        /* Promotional / Urgency */
  --status-success: #10b981;
  --status-warning: #f59e0b;
  --status-danger: #dc2626;

  /* Borders & Dividers */
  --border-light: #e2e8f0;
  --border-strong: #cbd5e1;

  /* Radius Tokens */
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-xl: 24px;
}
```

### 2.2 Typography Scale
| Token | Font Size | Line Height | Weight | Usage |
| :--- | :--- | :--- | :--- | :--- |
| `display` | 48px - 56px | 1.1 | 900 (Black) | Hero announcement headlines |
| `h1` | 32px - 36px | 1.2 | 800 (Extrabold) | Page titles, primary sections |
| `h2` | 24px - 28px | 1.25 | 700 (Bold) | Section headings, modal titles |
| `h3` | 18px - 20px | 1.3 | 600 (Semibold) | Product cards, widget headers |
| `body` | 15px - 16px | 1.5 | 400 / 500 | Main reading, descriptions |
| `caption` | 12px - 13px | 1.4 | 500 / 600 | Metadata, timestamps, SKU labels |
| `badge` | 11px - 12px | 1.2 | 700 (Bold) | Stock badges, COD badges, seller tags |

---

## 3. Component Interaction & Usability Guidelines

### 3.1 Buttons & Interactive Targets
- Minimum touch target: 44px × 44px on all mobile viewports (`touch-manipulation`).
- Button states: Default, Hover (150ms smooth transition), Active (subtle scale-down 0.98), Loading (spinner with accessible text), Disabled (`cursor-not-allowed opacity-50`).
- No emoji icons — use SVG icons from `lucide-react` exclusively.

### 3.2 Product Cards
- Image container strictly fixed at 1:1 aspect ratio (`aspect-square`) with `loading="lazy"`.
- Price display: Prominent bold PKR value (`font-extrabold text-slate-900`) with compare-at price in strikethrough if discounted.
- Trust signals: "Fulfilled by WIZZ.PK Direct" or verified seller indicator; "Cash on Delivery Available" badge.
- Stock warning: Shows "Only X left" when sellable balance is between 1 and 10 units. Shows "Out of stock" badge when zero.

### 3.3 Forms & Inputs
- Visible, persistent floating or upper labels (`text-xs font-bold text-slate-700`).
- Inline error messages adjacent to the erroneous input with `aria-live="polite"` and clear remediation instructions.
- Visible focus rings with high contrast (`focus:ring-2 focus:ring-emerald-500 focus:outline-none`).

---

---

## 4. Established Marketplace Architecture (Amazon / eBay / Daraz Patterns)

### 4.0 Storefront Polish Revision (2026-10-25)
Supersedes the header colours and homepage composition below where they differ.
- **Brand band**: the header's main bar uses Pakistan green `--color-brand-ink: #013b23` (utility strip `#012a19`, hover `#0a5233`), white logotype, white search field and an orange-600 search button. Orange is the single action accent in the header and for "Add to cart"; rose-600 stays reserved for discount badges and Deals.
- **Canvas**: `--background: #f1f4f2`, so white section panels (`rounded-lg`, 1px slate-200 border, no shadow) separate clearly, as on marketplace homepages.
- **Fonts**: Plus Jakarta Sans loaded through `next/font/google` (self-hosted, no render-blocking CSS import).
- **Homepage**: hero row = category rail (lg+) | carousel of real marked-down products (biggest genuine discount first, pause control, honours reduced motion) | account, active-coupon and service panel (xl+). A coupon shows only when an active, in-date, under-limit `Coupon` row exists. Then Deals rail, image category tiles, Top picks grid (2/3/4/6 cols), New arrivals rail. The duplicate trust strip was removed; the footer carries it.
- **Product card**: no wishlist control until a wishlist API exists. Price set as small "Rs." plus a large tabular amount, compare-at price struck through below, delivery line ("Free delivery" above the configured threshold) and seller line. Quick add over the image on hover/focus refreshes the header cart count. Failed images fall back to a neutral package icon, including failures before hydration.
- **Listings**: 2 / 3 / 4 columns (mobile / md / xl).
- **Free-delivery copy** always reads `SITE_CONFIG.shipping.freeShippingThresholdMinor`; never hardcode the amount.

### 4.1 Header & Navigation (3-Tier Structure)
1. **Tier 1: Top Utility Strip** (`bg-slate-900 text-slate-300 text-xs`):
   - Nationwide delivery guarantee banner ("Fast Tracked Shipping across Pakistan • TCS & Leopards").
   - Interactive Delivery Location Selector ("Deliver to [City]" with modal selection for major Pakistani cities).
   - Direct utility links: "Sell on WIZZ.PK", "Customer Care / FAQ", "Admin Portal".
2. **Tier 2: Main Commerce Bar** (`bg-white border-b border-slate-200`):
   - High-contrast WIZZ.PK marketplace badge logo.
   - Prominent central search bar with integrated department filter and live auto-suggestions querying actual catalog products and categories with PKR prices and thumbnails.
   - User action clusters: Delivery City selector (mobile/desktop), Returns & Orders, and Cart with live count badge.
3. **Tier 3: Category Sub-Bar & Mega Menu Drawer**:
   - "All Departments" button triggering a high-density category drawer slide-over with product counts.
   - Quick navigation pills for top hardware categories (Smart Wearables, Ergonomic Setup, EDC & Tools, Audio, Power & Charging, Deals).

### 4.2 Merchandising Homepage
- **Compact Promotional Hero**: Clean marketplace banner with genuine promo voucher callout (`WIZZ10`) and immediate category discovery.
- **Amazon-Style 4-Card Merchandising Grid**: High-density feature cards providing instant shortcuts into Flash Deals, WIZZ Direct Flagship, New Arrivals, and Seller Onboarding.
- **Genuine Flash Deals**: Only displays products with real `compareAtPriceMinor > priceMinor` discounts, live discount percentage badges, and verified inventory countdowns.
- **Department Grid Tiles**: Rapid visual entry points into hardware taxonomy with real category product counts.
- **5-Column Hardware Showcase**: Dense 5-column product grid maximizing screen estate without oversized whitespace.
- **4-Pillar Commerce Trust Strip**: 100% Genuine Physical Products, Cash on Delivery Nationwide, 15-Minute Transactional Stock Reservation, 30-Day Transparent Doorstep Returns.

### 4.3 Catalog Discovery & Category Pages
- **Dense Product Grid**: 4 columns on large displays, 2 columns on mobile viewports for optimal scanning.
- **Faceted Filters**: Category taxonomy with product counts, price range filters, and In-Stock toggles.
- **Sticky Filter Sidebar** on desktop (`sticky top-28`) and accessible expandable filter drawer on mobile.
- **Active Filter Chips**: Interactive chips with individual remove actions and "Clear All" reset button.
- **SEO & Duplicate Content Policy**: Clean canonical URL on `/products`, with automatic `robots: { index: false, follow: true }` applied whenever faceted filters, query params, or pagination > 1 are present.

### 4.4 Product Details Page (3-Column Buy Box Layout)
- **Left Column (5 cols)**: 1:1 image gallery with thumbnail preview strip, genuine discount pill, out-of-stock overlay, and authenticity trust badges.
- **Center Column (4 cols)**: Product title, brand link, genuine star ratings and review count, price summary, variation swatches with real-time stock status, overview description, and technical specifications table (SKU, weight, attributes).
- **Right Column (3 cols) — Buy Box / Purchase Panel**:
  - Sticky at `top-28` for continuous purchasing visibility.
  - Price & Free Delivery eligibility indicator.
  - City delivery estimation ("Deliver to [City] • Standard delivery 2–4 days via TCS / Leopards").
  - Stock availability state (In Stock, Low Stock urgency when ≤ 10, Out of Stock).
  - Quantity selector up to available units.
  - Primary "Add to Cart" button (solid emerald).
  - Secondary "Buy Now" button (slate-900, adds to cart and redirects straight to checkout).
  - Ships from & Sold by metadata (WIZZ.PK Direct vs External Seller).
  - 15-Minute transactional stock reservation guarantee badge.
- **Mobile Sticky Purchase Bar**: Fixed to bottom with safe-area padding (`env(safe-area-inset-bottom)`), displaying variant title, PKR price, and prominent Add to Cart button.

### 4.5 Cart & Multi-Seller Packaging
- **Grouped by Seller Packages**: Cart items are cleanly separated by fulfilling seller organization ("Package 1: Fulfilled by WIZZ.PK Direct", "Package 2: Fulfilled by [Seller]"), mirroring Daraz and Amazon multi-seller fulfillment models.
- **Free Shipping Progress Meter**: Real-time progress bar toward the PKR 5,000 nationwide free shipping threshold.
- **Order Summary**: Authoritative breakdown of subtotal, applied promo code, estimated shipping, sales tax, and grand total in PKR.

---

## 5. Accessibility & Responsive Floor
- WCAG AA compliant contrast ratio (minimum 4.5:1 for body text, 3:1 for large headers).
- Keyboard navigability across full checkout, cart quantity adjustments, variant selection tabs, and admin filters.
- `prefers-reduced-motion` media queries respected for transitions.
- Responsive breakpoints tested at 360px, 390px, 768px, and 1440px.
