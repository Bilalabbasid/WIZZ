import Link from "next/link";
import { getFeaturedProducts, getCategories, getProducts } from "@/modules/catalog/services";
import { ProductCard } from "@/components/product-card";
import { ScrollRail } from "@/components/scroll-rail";
import { HeroCarousel, type HeroSlide } from "@/components/hero-carousel";
import {
  Zap,
  Truck,
  Banknote,
  RotateCcw,
  ChevronRight,
  Package,
  TicketPercent,
  LayoutGrid,
} from "lucide-react";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { SITE_CONFIG } from "@/lib/config";
import { formatCurrency } from "@/lib/formatters";
import { DiscountType, ProductStatus } from "@prisma/client";

const publicProductWhere = {
  status: ProductStatus.PUBLISHED,
  isApprovedByPlatform: true,
  media: { some: {} },
  sellerOrg: { operationalStatus: "ACTIVE" as const },
};

async function getActiveCoupon() {
  const now = new Date();
  const coupons = await prisma.coupon.findMany({
    where: {
      isActive: true,
      AND: [
        { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
        { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 5,
  });
  return coupons.find((c) => c.usageLimit === null || c.timesUsed < c.usageLimit) ?? null;
}

export default async function HomePage() {
  const [featuredProducts, categories, newArrivalsData, user, coupon, categoryCovers] = await Promise.all([
    getFeaturedProducts(12),
    getCategories(),
    getProducts({ sort: "newest", limit: 12 }),
    getCurrentUser(),
    getActiveCoupon(),
    // One representative product image per category for the category tiles
    prisma.product.findMany({
      where: publicProductWhere,
      distinct: ["categoryId"],
      orderBy: [{ featured: "desc" }, { createdAt: "desc" }],
      select: {
        categoryId: true,
        media: { orderBy: { displayOrder: "asc" }, take: 1, select: { url: true } },
      },
    }),
  ]);

  // Products with a genuine compare-at price (compareAtPriceMinor > priceMinor)
  const rawDealProducts = await prisma.product.findMany({
    where: {
      ...publicProductWhere,
      variants: { some: { isActive: true, compareAtPriceMinor: { not: null } } },
    },
    take: 24,
    orderBy: { createdAt: "desc" },
    include: {
      category: true,
      brand: true,
      sellerOrg: { select: { id: true, name: true, slug: true } },
      media: { orderBy: { displayOrder: "asc" } },
      variants: { where: { isActive: true }, include: { inventoryLevel: true } },
    },
  });

  const lowestPrice = (p: (typeof rawDealProducts)[number]) => Math.min(...p.variants.map((v) => v.priceMinor));
  const compareAt = (p: (typeof rawDealProducts)[number]) =>
    p.variants.find((v) => v.compareAtPriceMinor)?.compareAtPriceMinor ?? null;

  // Keep only real markdowns, de-duplicate titles, and spread across categories
  const seenTitles = new Set<string>();
  const perCategory = new Map<string, number>();
  const dealProducts: typeof rawDealProducts = [];
  for (const pass of [2, Infinity]) {
    if (dealProducts.length >= 12) break;
    for (const p of rawDealProducts) {
      const cmp = compareAt(p);
      if (!cmp || cmp <= lowestPrice(p) || seenTitles.has(p.title)) continue;
      const cat = p.categoryId ?? "none";
      if ((perCategory.get(cat) ?? 0) >= pass) continue;
      seenTitles.add(p.title);
      perCategory.set(cat, (perCategory.get(cat) ?? 0) + 1);
      dealProducts.push(p);
      if (dealProducts.length >= 12) break;
    }
  }

  // Hero slides: biggest real markdowns first
  const heroSlides: HeroSlide[] = [...dealProducts]
    .sort((a, b) => {
      const pct = (p: (typeof rawDealProducts)[number]) => 1 - lowestPrice(p) / (compareAt(p) ?? lowestPrice(p));
      return pct(b) - pct(a);
    })
    .slice(0, 5)
    .map((p) => {
      const thumb = p.media.find((m) => m.isThumbnail) ?? p.media[0];
      return {
        slug: p.slug,
        title: p.title,
        categoryName: p.category?.name ?? null,
        brandName: p.brand?.name ?? null,
        imageUrl: thumb.url,
        priceMinor: lowestPrice(p),
        compareAtMinor: compareAt(p),
      };
    });

  const coverByCategory = new Map(categoryCovers.map((c) => [c.categoryId, c.media[0]?.url]));
  const visibleCategories = categories.filter((c) => c._count.products > 0);
  const freeDeliveryLabel = formatCurrency(SITE_CONFIG.shipping.freeShippingThresholdMinor);

  const couponLabel = coupon
    ? coupon.discountType === DiscountType.PERCENTAGE
      ? `${coupon.discountValueMinor}% off`
      : `${formatCurrency(coupon.discountValueMinor)} off`
    : null;

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 pt-3 sm:pt-4 pb-12 space-y-3 sm:space-y-4">
      <h1 className="sr-only">WIZZ.PK: shop online with cash on delivery across Pakistan</h1>
      {/* Hero row: category rail, featured deals carousel, account + service panel */}
      <div className="grid gap-3 lg:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[220px_minmax(0,1fr)_240px] lg:h-[340px]">
        <nav aria-label="Shop by category" className="hidden lg:flex flex-col bg-white rounded-lg border border-slate-200 py-2 overflow-hidden">
          <p className="px-4 pt-1 pb-2 text-sm font-extrabold text-slate-900">Categories</p>
          <ul className="flex-1 overflow-y-auto no-scrollbar">
            {visibleCategories.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/categories/${c.slug}`}
                  className="group flex items-center justify-between gap-2 px-4 py-2 text-[13px] text-slate-700 hover:bg-emerald-50 hover:text-emerald-800 transition-colors"
                >
                  <span className="truncate">{c.name}</span>
                  <ChevronRight size={14} className="text-slate-300 group-hover:text-emerald-600 flex-shrink-0" />
                </Link>
              </li>
            ))}
          </ul>
          <Link
            href="/products"
            className="mx-2 mt-1 flex items-center gap-2 px-2 py-2 rounded-md text-[13px] font-bold text-emerald-700 hover:bg-emerald-50 transition-colors"
          >
            <LayoutGrid size={15} />
            <span>All products</span>
          </Link>
        </nav>

        {heroSlides.length > 0 ? (
          <HeroCarousel slides={heroSlides} />
        ) : (
          <section className="rounded-lg bg-brand-ink text-white p-6 sm:p-10 flex flex-col justify-center">
            <p className="text-2xl sm:text-4xl font-extrabold tracking-tight">Shop WIZZ.PK</p>
            <p className="mt-2 text-sm text-emerald-100/80 max-w-md">
              Cash on delivery across Pakistan, with free delivery on orders over {freeDeliveryLabel}.
            </p>
            <Link
              href="/products"
              className="mt-5 inline-flex self-start items-center h-11 px-5 rounded-md bg-white text-brand-ink text-sm font-bold hover:bg-emerald-50"
            >
              Browse all products
            </Link>
          </section>
        )}

        <aside className="hidden xl:flex flex-col gap-3">
          <div className="bg-white rounded-lg border border-slate-200 p-4">
            {user ? (
              <>
                <p className="text-sm font-extrabold text-slate-900">Hello, {user.firstName}</p>
                <p className="text-xs text-slate-500 mt-0.5">Track orders and manage returns.</p>
                <Link
                  href="/account"
                  className="mt-3 flex items-center justify-center h-9 rounded-md bg-brand-ink text-white text-[13px] font-bold hover:bg-brand-ink-soft transition-colors"
                >
                  Your orders
                </Link>
              </>
            ) : (
              <>
                <p className="text-sm font-extrabold text-slate-900">Welcome to WIZZ.PK</p>
                <p className="text-xs text-slate-500 mt-0.5">Sign in to track orders and check out faster.</p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Link
                    href="/login"
                    className="flex items-center justify-center h-9 rounded-md bg-brand-ink text-white text-[13px] font-bold hover:bg-brand-ink-soft transition-colors"
                  >
                    Sign in
                  </Link>
                  <Link
                    href="/register"
                    className="flex items-center justify-center h-9 rounded-md border border-slate-300 text-slate-800 text-[13px] font-bold hover:bg-slate-50 transition-colors"
                  >
                    Join
                  </Link>
                </div>
              </>
            )}
          </div>

          {coupon && couponLabel && (
            <div className="rounded-lg border border-dashed border-orange-300 bg-orange-50 p-4">
              <p className="flex items-center gap-1.5 text-[13px] font-bold text-orange-900">
                <TicketPercent size={16} className="text-orange-600" />
                <span>{couponLabel} with code</span>
              </p>
              <p className="mt-2 inline-block rounded bg-white border border-orange-200 px-2 py-1 text-sm font-extrabold tracking-wide text-slate-900">
                {coupon.code}
              </p>
              {coupon.minOrderAmountMinor > 0 && (
                <p className="mt-1.5 text-[11px] text-orange-900/80">
                  On orders over {formatCurrency(coupon.minOrderAmountMinor)}
                </p>
              )}
            </div>
          )}

          <ul className="bg-white rounded-lg border border-slate-200 p-2 flex-1 flex flex-col justify-around">
            <li>
              <Link href="/policies/shipping" className="flex items-start gap-3 p-2 rounded-md hover:bg-slate-50">
                <Banknote size={18} className="text-emerald-600 mt-0.5 flex-shrink-0" />
                <span>
                  <span className="block text-[13px] font-bold text-slate-900">Cash on delivery</span>
                  <span className="block text-[11px] text-slate-500">Pay when your parcel arrives</span>
                </span>
              </Link>
            </li>
            <li>
              <Link href="/policies/shipping" className="flex items-start gap-3 p-2 rounded-md hover:bg-slate-50">
                <Truck size={18} className="text-emerald-600 mt-0.5 flex-shrink-0" />
                <span>
                  <span className="block text-[13px] font-bold text-slate-900">Free delivery</span>
                  <span className="block text-[11px] text-slate-500">On orders over {freeDeliveryLabel}</span>
                </span>
              </Link>
            </li>
            <li>
              <Link href="/policies/returns" className="flex items-start gap-3 p-2 rounded-md hover:bg-slate-50">
                <RotateCcw size={18} className="text-emerald-600 mt-0.5 flex-shrink-0" />
                <span>
                  <span className="block text-[13px] font-bold text-slate-900">30-day returns</span>
                  <span className="block text-[11px] text-slate-500">Return unused items in original packaging</span>
                </span>
              </Link>
            </li>
          </ul>
        </aside>
      </div>

      {/* Deals */}
      {dealProducts.length > 0 && (
        <HomeSection
          title={
            <span className="flex items-center gap-1.5 text-rose-600">
              <Zap size={18} className="fill-rose-600" />
              <span>Deals</span>
            </span>
          }
          subtitle={`${dealProducts.length} items marked down from their regular price`}
          href="/products?deals=true"
          linkLabel="See all deals"
        >
          <ScrollRail label="Deals">
            {dealProducts.map((p, i) => (
              <ProductCard key={p.id} product={p} priority={i < 3} />
            ))}
          </ScrollRail>
        </HomeSection>
      )}

      {/* Categories */}
      {visibleCategories.length > 0 && (
        <HomeSection title="Shop by category" href="/products" linkLabel="All products">
          <ul className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2.5 sm:gap-3">
            {visibleCategories.map((c) => {
              const cover = c.imageUrl || coverByCategory.get(c.id);
              return (
                <li key={c.id}>
                  <Link href={`/categories/${c.slug}`} className="group block">
                    <span className="block aspect-[4/3] rounded-md overflow-hidden bg-slate-100">
                      {cover ? (
                        <img
                          src={cover}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
                        />
                      ) : (
                        <span className="w-full h-full flex items-center justify-center text-slate-300">
                          <Package size={32} strokeWidth={1.25} />
                        </span>
                      )}
                    </span>
                    <span className="mt-2 block text-[13px] sm:text-sm font-bold text-slate-900 group-hover:text-emerald-800 truncate">
                      {c.name}
                    </span>
                    <span className="block text-[11px] text-slate-500 tabular-nums">
                      {c._count.products} {c._count.products === 1 ? "product" : "products"}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </HomeSection>
      )}

      {/* Featured */}
      {featuredProducts.length > 0 && (
        <HomeSection title="Top picks" href="/products?sort=featured" linkLabel="See more">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-2.5 sm:gap-3">
            {featuredProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </HomeSection>
      )}

      {/* New arrivals */}
      {newArrivalsData.products.length > 0 && (
        <HomeSection title="New arrivals" href="/products?sort=newest" linkLabel="See all new">
          <ScrollRail label="New arrivals">
            {newArrivalsData.products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </ScrollRail>
        </HomeSection>
      )}
    </div>
  );
}

function HomeSection({
  title,
  subtitle,
  href,
  linkLabel,
  children,
}: {
  title: React.ReactNode;
  subtitle?: string;
  href: string;
  linkLabel: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-white rounded-lg border border-slate-200 p-3 sm:p-5">
      <div className="flex items-end justify-between gap-3 mb-3 sm:mb-4">
        <div className="min-w-0">
          <h2 className="text-lg sm:text-xl font-extrabold tracking-tight text-slate-900">{title}</h2>
          {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
        <Link
          href={href}
          className="flex items-center gap-0.5 text-[13px] font-bold text-emerald-700 hover:text-emerald-900 whitespace-nowrap"
        >
          <span>{linkLabel}</span>
          <ChevronRight size={15} />
        </Link>
      </div>
      {children}
    </section>
  );
}
