import { prisma } from "@/lib/db";
import { Prisma, ProductStatus } from "@prisma/client";
import { getCommerceSettings } from "@/lib/commerce-settings";

/**
 * The single public-visibility rule for products: published, approved by the
 * platform, and sold by an active seller. Every storefront read (listings,
 * product page, search suggestions, cart) must apply it.
 */
export const publicProductWhere = {
  status: ProductStatus.PUBLISHED,
  isApprovedByPlatform: true,
  sellerOrg: { operationalStatus: "ACTIVE" },
} satisfies Prisma.ProductWhereInput;

export const PRODUCT_SORTS = ["featured", "price_asc", "price_desc", "newest", "rating"] as const;
export type ProductSort = (typeof PRODUCT_SORTS)[number];

export interface ProductFilterOptions {
  categorySlug?: string;
  /** Explicit category id set (e.g. a category plus its descendants). Takes precedence over categorySlug. */
  categoryIds?: string[];
  query?: string;
  brandSlug?: string;
  sellerOrgSlug?: string;
  minPriceMinor?: number;
  maxPriceMinor?: number;
  inStockOnly?: boolean;
  minRating?: number;
  dealsOnly?: boolean;
  freeShippingOnly?: boolean;
  sort?: ProductSort;
  page?: number;
  limit?: number;
}

type RawParam = string | string[] | undefined;

function firstParam(v: RawParam): string | undefined {
  const s = Array.isArray(v) ? v[0] : v;
  return typeof s === "string" && s.trim() !== "" ? s.trim() : undefined;
}

// Prisma Int columns are 32-bit; keep price bounds well inside that range.
const MAX_PRICE_MINOR = 2_000_000_000;
const MAX_PAGE = 10_000;

function parsePriceToMinor(v: RawParam): number | undefined {
  const s = firstParam(v);
  if (s === undefined) return undefined;
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) return undefined;
  return Math.min(Math.round(n * 100), MAX_PRICE_MINOR);
}

/**
 * Turns untrusted listing query-string values into safe filter options.
 * Non-numeric, negative or out-of-range values are dropped instead of being
 * passed to Prisma (where NaN would throw).
 */
export function parseListingParams(params: {
  page?: RawParam;
  minPrice?: RawParam;
  maxPrice?: RawParam;
  rating?: RawParam;
  sort?: RawParam;
}) {
  const rawPage = Number(firstParam(params.page) ?? "1");
  const page = Number.isFinite(rawPage) ? Math.min(Math.max(1, Math.floor(rawPage)), MAX_PAGE) : 1;

  let minPriceMinor = parsePriceToMinor(params.minPrice);
  let maxPriceMinor = parsePriceToMinor(params.maxPrice);
  if (minPriceMinor !== undefined && maxPriceMinor !== undefined && minPriceMinor > maxPriceMinor) {
    [minPriceMinor, maxPriceMinor] = [maxPriceMinor, minPriceMinor];
  }

  const rawRating = Number(firstParam(params.rating));
  const minRating =
    Number.isInteger(rawRating) && rawRating >= 1 && rawRating <= 5 ? rawRating : undefined;

  const rawSort = firstParam(params.sort);
  const sort = (PRODUCT_SORTS as readonly string[]).includes(rawSort ?? "")
    ? (rawSort as ProductSort)
    : undefined;

  return { page, minPriceMinor, maxPriceMinor, minRating, sort };
}

export async function getCategories() {
  return prisma.category.findMany({
    where: { isActive: true },
    orderBy: { displayOrder: "asc" },
    include: {
      _count: {
        select: {
          products: { where: publicProductWhere },
        },
      },
    },
  });
}

export async function getCategoryBySlug(slug: string) {
  return prisma.category.findUnique({
    where: { slug },
    include: {
      parent: true,
      children: { where: { isActive: true }, orderBy: { displayOrder: "asc" } },
    },
  });
}

/**
 * Resolves an active category slug to its id plus the ids of all active
 * descendants (so a parent category lists its sub-categories' products).
 * Returns null when the category does not exist or is inactive.
 */
export async function getCategoryTreeIds(slug: string): Promise<string[] | null> {
  const all = await prisma.category.findMany({
    where: { isActive: true },
    select: { id: true, slug: true, parentId: true },
  });
  const root = all.find((c) => c.slug === slug);
  if (!root) return null;

  const childrenByParent = new Map<string, string[]>();
  for (const c of all) {
    if (!c.parentId) continue;
    const list = childrenByParent.get(c.parentId) ?? [];
    list.push(c.id);
    childrenByParent.set(c.parentId, list);
  }

  const ids: string[] = [];
  const seen = new Set<string>();
  const queue = [root.id];
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (seen.has(id)) continue; // guard against accidental cycles
    seen.add(id);
    ids.push(id);
    queue.push(...(childrenByParent.get(id) ?? []));
  }
  return ids;
}

/**
 * Returns available filter metadata (brands, price boundaries) scoped to a category
 * and its active descendants. Returns null for missing or inactive categories.
 */
export async function getCategoryFilterMetadata(categorySlug: string) {
  const category = await getCategoryBySlug(categorySlug);
  if (!category || !category.isActive) return null;

  const categoryIds = (await getCategoryTreeIds(categorySlug)) ?? [category.id];

  // Retrieve brands associated with publicly listed products in this category tree
  const productsInCategory = await prisma.product.findMany({
    where: {
      ...publicProductWhere,
      categoryId: { in: categoryIds },
      media: { some: {} },
    },
    select: {
      brand: true,
      variants: {
        where: { isActive: true },
        select: { priceMinor: true },
      },
    },
  });

  const brandMap = new Map<string, { id: string; name: string; slug: string; count: number }>();
  let minPrice = Infinity;
  let maxPrice = 0;

  for (const p of productsInCategory) {
    if (p.brand) {
      const existing = brandMap.get(p.brand.id);
      if (existing) {
        existing.count++;
      } else {
        brandMap.set(p.brand.id, {
          id: p.brand.id,
          name: p.brand.name,
          slug: p.brand.slug,
          count: 1,
        });
      }
    }

    for (const v of p.variants) {
      if (v.priceMinor < minPrice) minPrice = v.priceMinor;
      if (v.priceMinor > maxPrice) maxPrice = v.priceMinor;
    }
  }

  return {
    category,
    categoryIds,
    subcategories: category.children,
    availableBrands: Array.from(brandMap.values()).sort((a, b) => a.name.localeCompare(b.name)),
    priceRange: {
      minPriceMinor: minPrice === Infinity ? 0 : minPrice,
      maxPriceMinor: maxPrice,
    },
    totalProducts: productsInCategory.length,
  };
}

export async function getFeaturedProducts(limit: number = 8) {
  return prisma.product.findMany({
    where: {
      ...publicProductWhere,
      featured: true,
      media: { some: {} },
    },
    take: limit,
    orderBy: { createdAt: "desc" },
    include: {
      category: true,
      brand: true,
      sellerOrg: { select: { id: true, name: true, slug: true } },
      media: { orderBy: { displayOrder: "asc" } },
      variants: {
        where: { isActive: true },
        omit: { costPriceMinor: true }, // seller cost never leaves the server
          include: { inventoryLevel: { select: { availableUnits: true, reservedUnits: true, lowStockThreshold: true, safetyStock: true } } },
      },
    },
  });
}

/** Repeated query-string keys arrive as arrays; only plain strings are usable filters. */
function asString(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() !== "" ? v : undefined;
}

export async function getProducts(options: ProductFilterOptions = {}) {
  const categorySlug = asString(options.categorySlug);
  const query = asString(options.query);
  const brandSlug = asString(options.brandSlug);
  const sellerOrgSlug = asString(options.sellerOrgSlug);
  const {
    categoryIds,
    minPriceMinor,
    maxPriceMinor,
    inStockOnly,
    minRating,
    dealsOnly,
    freeShippingOnly,
    sort = "featured",
    page = 1,
    limit = 12,
  } = options;

  const whereClause: Record<string, unknown> = {
    ...publicProductWhere,
    media: { some: {} },
  };

  if (categoryIds) {
    whereClause.categoryId = { in: categoryIds };
  } else if (categorySlug) {
    // A category lists its own products plus those of its active sub-categories.
    // Unknown or inactive categories resolve to an empty id set (no results).
    whereClause.categoryId = { in: (await getCategoryTreeIds(categorySlug)) ?? [] };
  }

  if (brandSlug) {
    whereClause.brand = { slug: brandSlug };
  }

  if (sellerOrgSlug) {
    whereClause.sellerOrg = { slug: sellerOrgSlug, operationalStatus: "ACTIVE" };
  }

  if (minRating !== undefined && minRating > 0) {
    // "N stars & up" means the average of approved reviews is at least N,
    // not that any single review reached N.
    const rated = await prisma.review.groupBy({
      by: ["productId"],
      where: { isApproved: true },
      _avg: { rating: true },
      having: { rating: { _avg: { gte: minRating } } },
    });
    whereClause.id = { in: rated.map((r) => r.productId) };
  }

  if (query && query.trim().length > 0) {
    const q = query.trim();
    whereClause.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
      { category: { name: { contains: q, mode: "insensitive" } } },
      { brand: { name: { contains: q, mode: "insensitive" } } },
    ];
  }

  const variantFilter: Record<string, unknown> = { isActive: true };

  if (minPriceMinor !== undefined || maxPriceMinor !== undefined) {
    variantFilter.priceMinor = {
      ...(minPriceMinor !== undefined ? { gte: minPriceMinor } : {}),
      ...(maxPriceMinor !== undefined ? { lte: maxPriceMinor } : {}),
    };
  }

  if (freeShippingOnly) {
    const { freeShippingThresholdMinor } = await getCommerceSettings();
    variantFilter.priceMinor = {
      ...((variantFilter.priceMinor as Record<string, number>) || {}),
      gte: Math.max(freeShippingThresholdMinor, minPriceMinor || 0),
    };
  }

  if (dealsOnly) {
    variantFilter.compareAtPriceMinor = { gt: 0 };
  }

  if (inStockOnly) {
    variantFilter.inventoryLevel = {
      availableUnits: { gt: 0 },
    };
  }

  if (
    Object.keys(variantFilter).length > 1 ||
    inStockOnly ||
    dealsOnly ||
    freeShippingOnly ||
    minPriceMinor !== undefined ||
    maxPriceMinor !== undefined
  ) {
    whereClause.variants = {
      some: variantFilter,
    };
  }

  // Always end with unique keys so pages never repeat or skip products
  let orderBy: Prisma.ProductOrderByWithRelationInput[] = [{ createdAt: "desc" }, { id: "asc" }];
  if (sort === "featured") {
    orderBy = [{ featured: "desc" }, { createdAt: "desc" }, { id: "asc" }];
  }

  const skip = Math.max(0, (page - 1) * limit);
  // These sorts are computed in memory, so they must see every match before paging
  const sortsInMemory = sort === "price_asc" || sort === "price_desc" || sort === "rating";

  const [rawProducts, total] = await Promise.all([
    prisma.product.findMany({
      where: whereClause,
      skip: sortsInMemory ? undefined : skip,
      take: sortsInMemory ? undefined : limit,
      orderBy,
      include: {
        category: true,
        brand: true,
        sellerOrg: { select: { id: true, name: true, slug: true } },
        media: { orderBy: { displayOrder: "asc" } },
        variants: {
          where: { isActive: true },
          omit: { costPriceMinor: true }, // seller cost never leaves the server
          include: { inventoryLevel: { select: { availableUnits: true, reservedUnits: true, lowStockThreshold: true, safetyStock: true } } },
        },
        reviews: {
          where: { isApproved: true },
          select: { rating: true },
        },
      },
    }),
    prisma.product.count({ where: whereClause }),
  ]);

  let products = rawProducts;

  // Handle price-based sorting by variant baseline prices
  if (sort === "price_asc") {
    products.sort((a, b) => {
      const minA = Math.min(...a.variants.map((v) => v.priceMinor), Infinity);
      const minB = Math.min(...b.variants.map((v) => v.priceMinor), Infinity);
      return minA - minB;
    });
    products = products.slice(skip, skip + limit);
  } else if (sort === "price_desc") {
    products.sort((a, b) => {
      const priceA = a.variants.length > 0 ? Math.min(...a.variants.map((v) => v.priceMinor)) : 0;
      const priceB = b.variants.length > 0 ? Math.min(...b.variants.map((v) => v.priceMinor)) : 0;
      return priceB - priceA;
    });
    products = products.slice(skip, skip + limit);
  } else if (sort === "rating") {
    products.sort((a, b) => {
      const avgA = a.reviews.length > 0 ? a.reviews.reduce((acc, r) => acc + r.rating, 0) / a.reviews.length : 0;
      const avgB = b.reviews.length > 0 ? b.reviews.reduce((acc, r) => acc + r.rating, 0) / b.reviews.length : 0;
      return avgB - avgA;
    });
    products = products.slice(skip, skip + limit);
  }

  const totalPages = Math.ceil(total / limit);

  return {
    products,
    total,
    page,
    limit,
    totalPages,
    hasPrevPage: page > 1,
    hasNextPage: page < totalPages,
  };
}

/**
 * Product page lookup. Applies the public-visibility rule, so drafts, archived,
 * unapproved products and products of inactive sellers resolve to null (404).
 */
export async function getProductBySlug(slug: string) {
  return prisma.product.findFirst({
    where: { slug, ...publicProductWhere },
    include: {
      category: true,
      brand: true,
      sellerOrg: {
        select: {
          id: true,
          name: true,
          slug: true,
          operationalStatus: true,
          logoUrl: true,
        },
      },
      media: { orderBy: { displayOrder: "asc" } },
      variants: {
        where: { isActive: true },
        omit: { costPriceMinor: true }, // seller cost never leaves the server
          include: { inventoryLevel: { select: { availableUnits: true, reservedUnits: true, lowStockThreshold: true, safetyStock: true } } },
      },
      reviews: {
        where: { isApproved: true },
        orderBy: { createdAt: "desc" },
        include: {
          customerUser: {
            select: { firstName: true, lastName: true },
          },
        },
      },
    },
  });
}

export async function getAllBrands() {
  return prisma.brand.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: {
        select: {
          products: { where: publicProductWhere },
        },
      },
    },
  });
}
