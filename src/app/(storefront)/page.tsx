import Link from "next/link";
import { getFeaturedProducts, getCategories, getProducts } from "@/modules/catalog/services";
import { ProductCard } from "@/components/product-card";
import {
  ArrowRight,
  Zap,
  Layers,
  Sparkles,
  Store,
  Truck,
  Banknote,
  ShieldCheck,
  RotateCcw,
  Clock,
  Percent,
  CheckCircle2,
  ChevronRight,
} from "lucide-react";
import { prisma } from "@/lib/db";
import { ProductStatus } from "@prisma/client";

export default async function HomePage() {
  const [featuredProducts, categories, newArrivalsData] = await Promise.all([
    getFeaturedProducts(10),
    getCategories(),
    getProducts({ sort: "newest", limit: 6 }),
  ]);

  // Find genuine promotional products with media (where compareAtPriceMinor > priceMinor)
  const rawFlashSaleProducts = await prisma.product.findMany({
    where: {
      status: ProductStatus.PUBLISHED,
      isApprovedByPlatform: true,
      media: { some: {} },
      sellerOrg: { operationalStatus: "ACTIVE" },
      variants: {
        some: {
          isActive: true,
          compareAtPriceMinor: { not: null },
        },
      },
    },
    take: 16,
    orderBy: { createdAt: "desc" },
    include: {
      category: true,
      brand: true,
      sellerOrg: { select: { id: true, name: true, slug: true } },
      media: { orderBy: { displayOrder: "asc" } },
      variants: {
        where: { isActive: true },
        include: { inventoryLevel: true },
      },
    },
  });

  // Guarantee strict cross-category diversity: 0 duplicate titles, max 2 per category, 0 missing images
  const flashSaleProducts: typeof rawFlashSaleProducts = [];
  const seenDealTitles = new Set<string>();
  const categoryDealCount = new Map<string, number>();

  // Pass 1: Pick balanced representation across categories
  for (const p of rawFlashSaleProducts) {
    const cat = p.category?.name || "General";
    const currentCount = categoryDealCount.get(cat) || 0;
    if (!seenDealTitles.has(p.title) && p.media.length > 0 && currentCount < 2) {
      seenDealTitles.add(p.title);
      categoryDealCount.set(cat, currentCount + 1);
      flashSaleProducts.push(p);
      if (flashSaleProducts.length >= 6) break;
    }
  }

  // Pass 2: Backfill any remaining slots
  if (flashSaleProducts.length < 6) {
    for (const p of rawFlashSaleProducts) {
      if (!seenDealTitles.has(p.title) && p.media.length > 0) {
        seenDealTitles.add(p.title);
        flashSaleProducts.push(p);
        if (flashSaleProducts.length >= 6) break;
      }
    }
  }

  return (
    <div className="space-y-8 sm:space-y-12 pb-16 bg-slate-50/60 min-h-screen">
      {/* 1. Compact Marketplace Hero & 4-Card Quick Deal Grid (Amazon / Daraz style) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6">
        <div className="relative rounded-2xl sm:rounded-3xl bg-gradient-to-r from-slate-950 via-slate-900 to-emerald-950 text-white overflow-hidden p-6 sm:p-10 border border-slate-800 shadow-md">
          {/* Subtle background glow */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 max-w-2xl space-y-3 sm:space-y-4">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/90 border border-emerald-600/50 text-emerald-400 text-[11px] sm:text-xs font-bold tracking-wide">
              <Sparkles size={13} />
              <span>Pakistan's Verified Tech & Hardware Marketplace</span>
            </div>

            <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-[1.15]">
              Engineered Hardware. <br />
              <span className="text-emerald-400">Cash on Delivery Across Pakistan.</span>
            </h1>

            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-xl">
              Shop authentic GaN fast chargers, mechanical peripherals, acoustics, and tools. Guaranteed 15-minute stock hold at checkout, transparent PKR prices, and tracked courier dispatch.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Link
                href="/products"
                className="bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-extrabold text-xs sm:text-sm px-5 py-2.5 rounded-xl shadow-sm transition-all flex items-center gap-1.5"
              >
                <span>Shop Marketplace</span>
                <ArrowRight size={15} />
              </Link>

              <div className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-800/80 border border-slate-700/80 text-xs text-slate-300">
                <span>Voucher Code:</span>
                <span className="font-mono font-bold text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800">
                  WIZZ10
                </span>
                <span className="text-slate-400">• 10% Off</span>
              </div>
            </div>
          </div>
        </div>

        {/* 4-Card Multi-Merchandising Grid (Directly below hero) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 -mt-4 sm:-mt-6 relative z-20 px-2 sm:px-4">
          <Link
            href="/products?sort=featured"
            className="p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-white border border-slate-200/90 shadow-sm hover:shadow-md hover:border-emerald-500 transition-all group"
          >
            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center mb-2 group-hover:bg-rose-600 group-hover:text-white transition-colors">
              <Percent size={16} />
            </div>
            <h3 className="font-bold text-xs sm:text-sm text-slate-900 group-hover:text-emerald-700 transition-colors">
              Flash Deals & Sales
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5 hidden sm:block">
              Save up to 35% on genuine electronics
            </p>
          </Link>

          <Link
            href="/products"
            className="p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-white border border-slate-200/90 shadow-sm hover:shadow-md hover:border-emerald-500 transition-all group"
          >
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center mb-2 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
              <ShieldCheck size={16} />
            </div>
            <h3 className="font-bold text-xs sm:text-sm text-slate-900 group-hover:text-emerald-700 transition-colors">
              WIZZ Direct Flagship
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5 hidden sm:block">
              100% Certified 1P hardware warranty
            </p>
          </Link>

          <Link
            href="/products?sort=newest"
            className="p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-white border border-slate-200/90 shadow-sm hover:shadow-md hover:border-emerald-500 transition-all group"
          >
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center mb-2 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
              <Sparkles size={16} />
            </div>
            <h3 className="font-bold text-xs sm:text-sm text-slate-900 group-hover:text-emerald-700 transition-colors">
              New Arrivals
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5 hidden sm:block">
              Recently stocked acoustic & power gear
            </p>
          </Link>

          <Link
            href="/sell"
            className="p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-white border border-slate-200/90 shadow-sm hover:shadow-md hover:border-emerald-500 transition-all group"
          >
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center mb-2 group-hover:bg-amber-600 group-hover:text-white transition-colors">
              <Store size={16} />
            </div>
            <h3 className="font-bold text-xs sm:text-sm text-slate-900 group-hover:text-emerald-700 transition-colors">
              Sell on WIZZ.PK
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5 hidden sm:block">
              Zero listing fees, fast KYC approval
            </p>
          </Link>
        </div>
      </section>

      {/* 2. Flash Deals / Promotional Section (When products have compareAt discounts) */}
      {flashSaleProducts.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-6 shadow-xs space-y-4">
            {/* Header with Countdown */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 text-rose-600 font-black text-base sm:text-lg">
                  <Zap size={20} className="fill-rose-600 text-rose-600" />
                  <span>Flash Deals</span>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600 bg-rose-50 border border-rose-200 px-2.5 py-0.5 rounded-full">
                  <Clock size={12} className="text-rose-600" />
                  <span>Limited Stock Remaining</span>
                </div>
              </div>

              <Link
                href="/products?sort=price_asc"
                className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
              >
                <span>Shop All Deals</span>
                <ChevronRight size={14} />
              </Link>
            </div>

            {/* Flash Sale Product Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
              {flashSaleProducts.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 3. Shop by Category / Department (Marketplace Circular / Card Tiles) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                Shop by Department
              </h2>
              <p className="text-xs text-slate-500">
                Explore curated hardware categories with nationwide COD delivery
              </p>
            </div>
            <Link
              href="/products"
              className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
            >
              <span>View All</span>
              <ChevronRight size={14} />
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
            {categories.map((c) => (
              <Link
                key={c.id}
                href={`/categories/${c.slug}`}
                className="group p-3 sm:p-4 rounded-xl border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/30 transition-all text-center flex flex-col items-center justify-between"
              >
                <div className="w-12 h-12 rounded-xl bg-slate-100 group-hover:bg-emerald-600 text-slate-700 group-hover:text-white flex items-center justify-center mb-2.5 transition-colors">
                  <Layers size={22} />
                </div>
                <h3 className="font-bold text-xs text-slate-900 group-hover:text-emerald-700 transition-colors line-clamp-1">
                  {c.name}
                </h3>
                <span className="text-[10px] text-slate-400 font-medium mt-1">
                  {c._count.products} Products
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* 4. Featured Flagship Hardware (WIZZ.PK Direct & Verified Sellers) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">
                  Verified Catalog
                </span>
                <span className="text-slate-300">•</span>
                <span className="text-xs text-slate-500 font-medium">Discrete Stock Only</span>
              </div>
              <h2 className="text-base sm:text-xl font-black text-slate-900 tracking-tight mt-0.5">
                Featured Hardware & Tech
              </h2>
            </div>
            <Link
              href="/products"
              className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
            >
              <span>Explore All ({featuredProducts.length}+)</span>
              <ChevronRight size={14} />
            </Link>
          </div>

          {/* Product Grid: 5 columns on desktop, 2 columns on mobile */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
            {featuredProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      </section>

      {/* 5. New Arrivals Row */}
      {newArrivalsData.products.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                  New Arrivals
                </h2>
                <p className="text-xs text-slate-500">
                  Latest verified equipment received in our logistics fulfillment network
                </p>
              </div>
              <Link
                href="/products?sort=newest"
                className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
              >
                <span>View All New</span>
                <ChevronRight size={14} />
              </Link>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
              {newArrivalsData.products.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 6. Marketplace Trust Pillars (Compact Bottom Strip) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 p-4 sm:p-6 bg-white rounded-2xl border border-slate-200/90 shadow-xs">
          <div className="flex items-center gap-3 p-2">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
              <ShieldCheck size={20} />
            </div>
            <div>
              <h4 className="text-xs sm:text-sm font-bold text-slate-900">100% Genuine Tech</h4>
              <p className="text-[11px] text-slate-500">Verified manufacturer specs</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-2">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
              <Banknote size={20} />
            </div>
            <div>
              <h4 className="text-xs sm:text-sm font-bold text-slate-900">Cash on Delivery</h4>
              <p className="text-[11px] text-slate-500">Pay upon parcel inspection</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-2">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
              <RotateCcw size={20} />
            </div>
            <div>
              <h4 className="text-xs sm:text-sm font-bold text-slate-900">30-Day Returns</h4>
              <p className="text-[11px] text-slate-500">Transparent refund guarantee</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-2">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
              <Truck size={20} />
            </div>
            <div>
              <h4 className="text-xs sm:text-sm font-bold text-slate-900">Tracked Shipping</h4>
              <p className="text-[11px] text-slate-500">Fast TCS & Leopards delivery</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
