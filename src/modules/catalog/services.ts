import { prisma } from "@/lib/db";
import { ProductStatus } from "@prisma/client";

export interface ProductFilterOptions {
  categorySlug?: string;
  query?: string;
  brandSlug?: string;
  sellerOrgSlug?: string;
  minPriceMinor?: number;
  maxPriceMinor?: number;
  inStockOnly?: boolean;
  minRating?: number;
  dealsOnly?: boolean;
  freeShippingOnly?: boolean;
  sort?: "featured" | "price_asc" | "price_desc" | "newest" | "rating";
  page?: number;
  limit?: number;
}

export async function getCategories() {
  return prisma.category.findMany({
    where: { isActive: true },
    orderBy: { displayOrder: "asc" },
    include: {
      _count: {
        select: {
          products: {
            where: {
              status: ProductStatus.PUBLISHED,
              isApprovedByPlatform: true,
              sellerOrg: { operationalStatus: "ACTIVE" },
            },
          },
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
      children: { where: { isActive: true } },
    },
  });
}

/**
 * Returns available filter metadata (brands, price boundaries) scoped to a category.
 */
export async function getCategoryFilterMetadata(categorySlug: string) {
  const category = await prisma.category.findUnique({
    where: { slug: categorySlug },
    include: {
      parent: true,
      children: { where: { isActive: true } },
    },
  });

  if (!category) return null;

  // Retrieve brands associated with products in this category
  const productsInCategory = await prisma.product.findMany({
    where: {
      categoryId: category.id,
      status: ProductStatus.PUBLISHED,
      isApprovedByPlatform: true,
      sellerOrg: { operationalStatus: "ACTIVE" },
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
      status: ProductStatus.PUBLISHED,
      isApprovedByPlatform: true,
      featured: true,
      media: { some: {} },
      sellerOrg: { operationalStatus: "ACTIVE" },
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
        include: { inventoryLevel: true },
      },
    },
  });
}

export async function getProducts(options: ProductFilterOptions = {}) {
  const {
    categorySlug,
    query,
    brandSlug,
    sellerOrgSlug,
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
    status: ProductStatus.PUBLISHED,
    isApprovedByPlatform: true,
    media: { some: {} },
    sellerOrg: { operationalStatus: "ACTIVE" },
  };

  if (categorySlug) {
    whereClause.category = { slug: categorySlug };
  }

  if (brandSlug) {
    whereClause.brand = { slug: brandSlug };
  }

  if (sellerOrgSlug) {
    whereClause.sellerOrg = { slug: sellerOrgSlug, operationalStatus: "ACTIVE" };
  }

  if (minRating !== undefined && minRating > 0) {
    whereClause.reviews = {
      some: {
        rating: { gte: minRating },
        isApproved: true,
      },
    };
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
    variantFilter.priceMinor = {
      ...((variantFilter.priceMinor as Record<string, number>) || {}),
      gte: Math.max(500000, minPriceMinor || 0),
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

  let orderBy: Record<string, "asc" | "desc"> = { createdAt: "desc" };
  if (sort === "newest") {
    orderBy = { createdAt: "desc" };
  } else if (sort === "featured") {
    orderBy = { featured: "desc" };
  }

  const skip = Math.max(0, (page - 1) * limit);

  const [rawProducts, total] = await Promise.all([
    prisma.product.findMany({
      where: whereClause,
      skip: sort === "price_asc" || sort === "price_desc" ? undefined : skip,
      take: sort === "price_asc" || sort === "price_desc" ? undefined : limit,
      orderBy,
      include: {
        category: true,
        brand: true,
        sellerOrg: { select: { id: true, name: true, slug: true } },
        media: { orderBy: { displayOrder: "asc" } },
        variants: {
          where: { isActive: true },
          include: { inventoryLevel: true },
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

export async function getProductBySlug(slug: string) {
  return prisma.product.findUnique({
    where: { slug },
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
        include: { inventoryLevel: true },
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
          products: {
            where: {
              status: ProductStatus.PUBLISHED,
              isApprovedByPlatform: true,
              sellerOrg: { operationalStatus: "ACTIVE" },
            },
          },
        },
      },
    },
  });
}
