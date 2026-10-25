import { prisma } from "@/lib/db";
import {
  Prisma,
  ProductStatus,
  ProductModerationStatus,
  InventoryAdjustmentReason,
  SellerOperationalStatus,
} from "@prisma/client";
import { z } from "zod";
import { isFirstPartySeller } from "@/lib/config";
import {
  getPricingIntent,
  resolveVariantPricing,
  validatePricingIntent,
  type SellerPricingIntent,
} from "./deal-pricing";

export interface CreateProductVariantInput {
  title: string;
  sku: string;
  priceMinor: number;
  compareAtPriceMinor?: number | null;
  costPriceMinor?: number | null;
  barcode?: string | null;
  attributes?: Record<string, string>;
  initialStock?: number;
  lowStockThreshold?: number;
  dealPriceMinor?: number | null;
  dealStartsAt?: string | Date | null;
  dealEndsAt?: string | Date | null;
}

export interface ProductImageInput {
  url: string;
  altText?: string;
  isThumbnail?: boolean;
  displayOrder?: number;
}

export interface CreateProductInput {
  title: string;
  slug?: string;
  description: string;
  categoryId: string;
  brandId?: string | null;
  /** "PUBLISHED" is treated as a request to publish (same as submitForReview). */
  status?: ProductStatus;
  metaTitle?: string | null;
  metaDescription?: string | null;
  attributes?: Record<string, string>;
  submitForReview?: boolean;
  weightGrams?: number;
  lengthMm?: number;
  widthMm?: number;
  heightMm?: number;
  images?: ProductImageInput[];
  variants: CreateProductVariantInput[];
}

export interface UpdateVariantInput {
  id?: string;
  title: string;
  sku: string;
  priceMinor: number;
  compareAtPriceMinor?: number | null;
  costPriceMinor?: number | null;
  barcode?: string | null;
  attributes?: Record<string, string>;
  isActive?: boolean;
  /** Desired on-hand stock. */
  availableUnits?: number;
  /** On-hand stock the editor loaded; the change is applied as a delta from it. */
  stockBaseline?: number;
  lowStockThreshold?: number;
  dealPriceMinor?: number | null;
  dealStartsAt?: string | Date | null;
  dealEndsAt?: string | Date | null;
}

export interface UpdateProductInput {
  title?: string;
  slug?: string;
  description?: string;
  categoryId?: string;
  brandId?: string | null;
  /** DRAFT takes a listing offline, ARCHIVED retires it, PUBLISHED requests publishing. */
  status?: ProductStatus;
  metaTitle?: string | null;
  metaDescription?: string | null;
  attributes?: Record<string, string>;
  submitForReview?: boolean;
  /** Deprecated: content edits to an approved listing are always staged for review. */
  stageEditsIfPublished?: boolean;
  weightGrams?: number;
  lengthMm?: number;
  widthMm?: number;
  heightMm?: number;
  images?: ProductImageInput[];
  /** When provided, this is the full variant list: omitted existing variants are deactivated. */
  variants?: UpdateVariantInput[];
}

/** Content changes to an approved listing, held for platform review. */
interface StagedRevision {
  title?: string;
  slug?: string;
  description?: string;
  categoryId?: string;
  brandId?: string | null;
  metaTitle?: string | null;
  metaDescription?: string | null;
  attributes?: Record<string, string>;
  weightGrams?: number;
  lengthMm?: number;
  widthMm?: number;
  heightMm?: number;
  images?: ProductImageInput[];
  variantContent?: Array<{ id: string; title: string; sku: string; barcode: string | null; attributes: Record<string, string> }>;
  newVariants?: UpdateVariantInput[];
  /** Legacy staged payloads stored the whole update input. */
  variants?: UpdateVariantInput[];
}

export interface BulkVariantUpdateItem {
  variantId: string;
  priceMinor?: number;
  compareAtPriceMinor?: number | null;
  stock?: number;
  stockBaseline?: number;
  isActive?: boolean;
}

export interface CsvProductRow {
  sku: string;
  title?: string;
  category?: string;
  pricePkr?: number;
  compareAtPricePkr?: number | null;
  stock?: number;
  variantTitle?: string;
  barcode?: string;
  description?: string;
  attributes?: Record<string, string>;
}

export interface CsvImportResult {
  totalRows: number;
  validCount: number;
  errorCount: number;
  createdProducts: number;
  updatedVariants: number;
  createdVariants: number;
  errors: Array<{
    row: number;
    sku?: string;
    message: string;
  }>;
  previewRows?: Array<{
    row: number;
    sku: string;
    title: string;
    pricePkr: number;
    compareAtPricePkr?: number | null;
    stock: number;
    action: "CREATE" | "UPDATE";
    isValid: boolean;
    error?: string;
  }>;
}

// ----------------------------------------------------
// Input validation (server boundary)
// ----------------------------------------------------

const MAX_PRICE_MINOR = 100_000_000_00; // PKR 100,000,000
const MAX_STOCK = 1_000_000;

const moneyMinor = z.number().int("Prices must be whole paisa amounts.").min(0).max(MAX_PRICE_MINOR);
const optionalMoney = moneyMinor.nullable().optional();
const optionalDate = z
  .union([z.string(), z.date()])
  .nullable()
  .optional()
  .transform((v, ctx) => {
    if (v == null || v === "") return null;
    const d = v instanceof Date ? v : new Date(v);
    if (Number.isNaN(d.getTime())) {
      ctx.addIssue({ code: "custom", message: "Invalid date." });
      return z.NEVER;
    }
    return d;
  });

const attributeRecord = z
  .record(z.string().trim().min(1).max(60), z.string().trim().max(200))
  .refine((r) => Object.keys(r).length <= 40, "A product can have at most 40 specifications.");

/** Uploaded public media served by this app, or an https URL. */
const imageUrl = z
  .string()
  .trim()
  .max(2000)
  .refine(
    (u) => u.startsWith("/api/uploads/serve?key=public%2F") || u.startsWith("/api/uploads/serve?key=public/") || /^https:\/\/[^\s"'<>]+$/i.test(u),
    "Images must be uploaded files or https:// links."
  );

const imageSchema = z.object({
  url: imageUrl,
  altText: z.string().trim().max(200).optional(),
  isThumbnail: z.boolean().optional(),
  displayOrder: z.number().int().min(0).optional(),
});

const skuSchema = z
  .string()
  .trim()
  .min(1, "Every variant needs a SKU.")
  .max(64, "SKUs can be at most 64 characters.")
  .regex(/^[A-Za-z0-9][A-Za-z0-9._\-/]*$/, "SKUs may contain letters, numbers, dots, dashes, underscores and slashes.");

const variantBase = {
  title: z.string().trim().min(1, "Every variant needs a name.").max(120),
  sku: skuSchema,
  priceMinor: moneyMinor,
  compareAtPriceMinor: optionalMoney,
  costPriceMinor: optionalMoney,
  barcode: z.string().trim().max(64).nullable().optional(),
  attributes: attributeRecord.optional(),
  lowStockThreshold: z.number().int().min(0).max(MAX_STOCK).optional(),
  dealPriceMinor: optionalMoney,
  dealStartsAt: optionalDate,
  dealEndsAt: optionalDate,
};

const createVariantSchema = z.object({
  ...variantBase,
  initialStock: z.number().int().min(0, "Variant stock quantity cannot be negative.").max(MAX_STOCK).optional(),
});

const updateVariantSchema = z.object({
  ...variantBase,
  id: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
  availableUnits: z.number().int().min(0, "Variant stock quantity cannot be negative.").max(MAX_STOCK).optional(),
  stockBaseline: z.number().int().min(0).max(MAX_STOCK).optional(),
});

const productBase = {
  slug: z.string().trim().max(120).optional(),
  brandId: z.string().min(1).nullable().optional(),
  status: z.nativeEnum(ProductStatus).optional(),
  metaTitle: z.string().trim().max(120).nullable().optional(),
  metaDescription: z.string().trim().max(320).nullable().optional(),
  attributes: attributeRecord.optional(),
  submitForReview: z.boolean().optional(),
  weightGrams: z.number().int().min(0).max(1_000_000).optional(),
  lengthMm: z.number().int().min(0).max(100_000).optional(),
  widthMm: z.number().int().min(0).max(100_000).optional(),
  heightMm: z.number().int().min(0).max(100_000).optional(),
  images: z.array(imageSchema).max(12, "A product can have at most 12 images.").optional(),
};

const createProductSchema = z.object({
  ...productBase,
  title: z.string().trim().min(3, "Product title must be at least 3 characters.").max(200),
  description: z.string().max(20_000, "Description can be at most 20,000 characters.").default(""),
  categoryId: z.string().min(1, "Choose a category."),
  variants: z.array(createVariantSchema).min(1, "At least one product variant is required.").max(100),
});

const updateProductSchema = z.object({
  ...productBase,
  title: z.string().trim().min(3, "Product title must be at least 3 characters.").max(200).optional(),
  description: z.string().max(20_000, "Description can be at most 20,000 characters.").optional(),
  categoryId: z.string().min(1).optional(),
  stageEditsIfPublished: z.boolean().optional(),
  variants: z.array(updateVariantSchema).min(1, "At least one product variant is required.").max(100).optional(),
});

function parseInput<T extends z.ZodTypeAny>(schema: T, raw: unknown): z.output<T> {
  const result = schema.safeParse(raw);
  if (!result.success) {
    const issue = result.error.issues[0];
    const where = issue.path.length ? ` (${issue.path.join(".")})` : "";
    throw new Error(`${issue.message}${where}`);
  }
  return result.data;
}

/**
 * Validates variant combinations for duplicates, promotional pricing sanity, and non-negative stock.
 */
export function validateVariants(variants: CreateProductVariantInput[]) {
  if (!variants || variants.length === 0) {
    throw new Error("At least one product variant is required.");
  }

  const seenSkus = new Set<string>();
  const seenAttrCombinations = new Set<string>();

  for (let i = 0; i < variants.length; i++) {
    const v = variants[i];
    const trimmedSku = v.sku.trim();
    if (!trimmedSku) {
      throw new Error(`Variant #${i + 1} is missing a SKU.`);
    }

    const normSku = trimmedSku.toUpperCase();
    if (seenSkus.has(normSku)) {
      throw new Error(`Duplicate SKU detected: "${trimmedSku}". Each variant must have a unique SKU.`);
    }
    seenSkus.add(normSku);

    // Validate duplicate attribute combinations
    if (v.attributes && Object.keys(v.attributes).length > 0) {
      const sortedEntries = Object.entries(v.attributes)
        .map(([k, val]) => `${k.toLowerCase().trim()}:${String(val).toLowerCase().trim()}`)
        .sort()
        .join("|");
      if (seenAttrCombinations.has(sortedEntries)) {
        throw new Error(
          `Duplicate variant options detected: variant "${v.title}" has the exact same attribute combination as another variant.`
        );
      }
      seenAttrCombinations.add(sortedEntries);
    }

    // Validate prices
    if (v.priceMinor < 0) {
      throw new Error(`Variant "${trimmedSku}" price cannot be negative.`);
    }

    if (v.compareAtPriceMinor != null) {
      if (v.compareAtPriceMinor <= v.priceMinor) {
        throw new Error(
          `Variant "${trimmedSku}": Compare-at promotional price (${v.compareAtPriceMinor / 100}) must be strictly greater than selling price (${v.priceMinor / 100}).`
        );
      }
    }

    // Validate stock
    if (v.initialStock != null && v.initialStock < 0) {
      throw new Error(`Variant "${trimmedSku}" stock quantity cannot be negative.`);
    }
  }
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 90);
}

/** Returns `base` or `base-N`, whichever is free (ignoring `excludeProductId`). */
async function findAvailableSlug(base: string, excludeProductId?: string) {
  const root = base || "product";
  for (let attempt = 0; attempt < 20; attempt++) {
    const candidate = attempt === 0 ? root : `${root}-${attempt + 1}`;
    const clash = await prisma.product.findFirst({
      where: { slug: candidate, ...(excludeProductId ? { id: { not: excludeProductId } } : {}) },
      select: { id: true },
    });
    if (!clash) return candidate;
  }
  return `${root}-${Date.now().toString(36)}`;
}

async function assertCatalogReferences(categoryId?: string, brandId?: string | null) {
  if (categoryId) {
    const category = await prisma.category.findUnique({ where: { id: categoryId }, select: { isActive: true } });
    if (!category || !category.isActive) throw new Error("Choose a valid, active category.");
  }
  if (brandId) {
    const brand = await prisma.brand.findUnique({ where: { id: brandId }, select: { id: true } });
    if (!brand) throw new Error("Choose a valid brand.");
  }
}

/** SKUs are unique across the whole catalog (CSV upserts and order lines match on SKU). */
async function assertSkusAvailable(skus: string[], ownProductId?: string) {
  if (skus.length === 0) return;
  const clash = await prisma.productVariant.findFirst({
    where: {
      sku: { in: skus, mode: "insensitive" },
      ...(ownProductId ? { productId: { not: ownProductId } } : {}),
    },
    select: { sku: true },
  });
  if (clash) {
    throw new Error(`SKU already exists in the catalog: "${clash.sku}". SKUs must be unique.`);
  }
}

function pricingIntentFromInput(v: {
  priceMinor: number;
  compareAtPriceMinor?: number | null;
  dealPriceMinor?: number | null;
  dealStartsAt?: Date | null;
  dealEndsAt?: Date | null;
}): SellerPricingIntent {
  return {
    regularPriceMinor: v.priceMinor,
    regularCompareAtMinor: v.compareAtPriceMinor ?? null,
    dealPriceMinor: v.dealPriceMinor ?? null,
    dealStartsAt: v.dealStartsAt ?? null,
    dealEndsAt: v.dealEndsAt ?? null,
  };
}

function sameDeal(a: SellerPricingIntent, b: SellerPricingIntent) {
  return (
    a.dealPriceMinor === b.dealPriceMinor &&
    a.dealStartsAt?.getTime() === b.dealStartsAt?.getTime() &&
    a.dealEndsAt?.getTime() === b.dealEndsAt?.getTime()
  );
}

function normalizeImages(images: ProductImageInput[], fallbackAlt: string) {
  const list = images.map((img, i) => ({
    url: img.url,
    altText: img.altText || fallbackAlt,
    displayOrder: i,
    isThumbnail: Boolean(img.isThumbnail),
  }));
  // Exactly one thumbnail
  const thumbIndex = Math.max(0, list.findIndex((img) => img.isThumbnail));
  return list.map((img, i) => ({ ...img, isThumbnail: i === thumbIndex }));
}

function stableAttrs(json: string | null | undefined): Record<string, string> {
  try {
    return JSON.parse(json || "{}");
  } catch {
    return {};
  }
}

function attrsEqual(a: Record<string, string>, b: Record<string, string>) {
  const ka = Object.keys(a).sort();
  const kb = Object.keys(b).sort();
  return ka.length === kb.length && ka.every((k, i) => k === kb[i] && a[k] === b[k]);
}

/** Seller Center tabs. */
export const SELLER_PRODUCT_VIEWS = {
  live: { status: ProductStatus.PUBLISHED },
  review: { moderationStatus: ProductModerationStatus.PENDING_REVIEW, status: { not: ProductStatus.ARCHIVED } },
  attention: {
    moderationStatus: { in: [ProductModerationStatus.CHANGES_REQUESTED, ProductModerationStatus.REJECTED] },
    status: { not: ProductStatus.ARCHIVED },
  },
  draft: { status: ProductStatus.DRAFT, isApprovedByPlatform: false },
  offline: { status: ProductStatus.DRAFT, isApprovedByPlatform: true },
  archived: { status: ProductStatus.ARCHIVED },
} satisfies Record<string, Prisma.ProductWhereInput>;

export type SellerProductView = keyof typeof SELLER_PRODUCT_VIEWS;

export function isSellerProductView(v: string | null | undefined): v is SellerProductView {
  return Boolean(v && v in SELLER_PRODUCT_VIEWS);
}

/** Product counts per Seller Center tab. */
export async function getSellerProductCounts(sellerOrgId: string) {
  const views = Object.keys(SELLER_PRODUCT_VIEWS) as SellerProductView[];
  const [all, ...counts] = await Promise.all([
    prisma.product.count({ where: { sellerOrgId, status: { not: ProductStatus.ARCHIVED } } }),
    ...views.map((view) => prisma.product.count({ where: { sellerOrgId, ...SELLER_PRODUCT_VIEWS[view] } })),
  ]);
  return { all, ...Object.fromEntries(views.map((view, i) => [view, counts[i]])) } as Record<SellerProductView | "all", number>;
}

/**
 * Lists products strictly belonging to a seller organization.
 */
export async function getSellerProducts(
  sellerOrgId: string,
  options: {
    query?: string;
    status?: ProductStatus;
    moderationStatus?: ProductModerationStatus;
    categoryId?: string;
    view?: SellerProductView;
    page?: number;
    limit?: number;
  } = {}
) {
  const { query, status, moderationStatus, categoryId } = options;
  const page = Math.max(1, Math.floor(options.page || 1));
  const limit = Math.min(100, Math.max(1, Math.floor(options.limit || 20)));
  const where: Prisma.ProductWhereInput = {
    sellerOrgId,
  };

  if (status) {
    where.status = status;
  }

  if (moderationStatus) {
    where.moderationStatus = moderationStatus;
  }

  if (categoryId) {
    where.categoryId = categoryId;
  }

  if (query && query.trim().length > 0) {
    const q = query.trim();
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
      { variants: { some: { sku: { contains: q, mode: "insensitive" } } } },
    ];
  }

  if (options.view) Object.assign(where, SELLER_PRODUCT_VIEWS[options.view]);
  else if (!status) where.status = { not: ProductStatus.ARCHIVED };

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { updatedAt: "desc" },
      include: {
        category: true,
        brand: true,
        media: { orderBy: { displayOrder: "asc" } },
        variants: {
          include: { inventoryLevel: true },
          orderBy: { createdAt: "asc" },
        },
      },
    }),
    prisma.product.count({ where }),
  ]);

  return { products, total, page, limit, totalPages: Math.ceil(total / limit) };
}

/**
 * Fetches a single product strictly scoped to the seller organization.
 */
export async function getSellerProductById(sellerOrgId: string, productId: string) {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: {
      category: true,
      brand: true,
      media: { orderBy: { displayOrder: "asc" } },
      variants: {
        include: { inventoryLevel: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!product || product.sellerOrgId !== sellerOrgId) {
    throw new Error(`FORBIDDEN: Product ${productId} not found or does not belong to your organization.`);
  }

  return product;
}

/**
 * Creates a new seller product with variants, media, opening stock and pricing.
 *
 * Publishing rules (server-enforced):
 * - Sellers whose organization is not ACTIVE can only save drafts.
 * - WIZZ.PK's own first-party store publishes directly.
 * - External sellers' listings go to PENDING_REVIEW; an admin approval makes them live.
 */
export async function createSellerProduct(
  sellerOrgId: string,
  rawInput: CreateProductInput,
  actorUserId?: string
) {
  const input = parseInput(createProductSchema, rawInput);

  const sellerOrg = await prisma.sellerOrg.findUnique({
    where: { id: sellerOrgId },
  });

  if (!sellerOrg) {
    throw new Error("Seller organization not found.");
  }

  validateVariants(input.variants);
  const now = new Date();
  for (const v of input.variants) {
    validatePricingIntent(pricingIntentFromInput(v), `Variant "${v.sku}"`, { now, isNewDeal: true });
  }
  await assertSkusAvailable(input.variants.map((v) => v.sku));
  await assertCatalogReferences(input.categoryId, input.brandId);

  const wantsPublish = Boolean(input.submitForReview) || input.status === ProductStatus.PUBLISHED;
  if (wantsPublish) {
    if (sellerOrg.operationalStatus !== SellerOperationalStatus.ACTIVE) {
      throw new Error(
        "Sellers cannot publish products until their organization application is approved and active. You may save this product as DRAFT."
      );
    }
    if (!input.description.trim()) throw new Error("Add a product description before publishing.");
    if (!input.images || input.images.length === 0) throw new Error("Add at least one product image before publishing.");
  }

  const firstParty = isFirstPartySeller(sellerOrg);
  let finalStatus: ProductStatus = ProductStatus.DRAFT;
  let finalModeration: ProductModerationStatus = ProductModerationStatus.DRAFT;
  if (wantsPublish && firstParty) {
    finalStatus = ProductStatus.PUBLISHED;
    finalModeration = ProductModerationStatus.APPROVED;
  } else if (wantsPublish) {
    finalModeration = ProductModerationStatus.PENDING_REVIEW;
  }

  const slug = await findAvailableSlug(slugify(input.slug || input.title));

  return prisma.$transaction(async (tx) => {
    const product = await tx.product.create({
      data: {
        sellerOrgId,
        title: input.title,
        slug,
        description: input.description,
        categoryId: input.categoryId,
        brandId: input.brandId || null,
        status: finalStatus,
        isApprovedByPlatform: finalStatus === ProductStatus.PUBLISHED,
        moderationStatus: finalModeration,
        metaTitle: input.metaTitle || null,
        metaDescription: input.metaDescription || null,
        attributesJson: JSON.stringify(input.attributes || {}),
        weightGrams: input.weightGrams || 0,
        lengthMm: input.lengthMm || 0,
        widthMm: input.widthMm || 0,
        heightMm: input.heightMm || 0,
      },
    });

    if (input.images && input.images.length > 0) {
      await tx.productMedia.createMany({
        data: normalizeImages(input.images, input.title).map((img) => ({ ...img, productId: product.id })),
      });
    }

    for (const v of input.variants) {
      const pricing = resolveVariantPricing(pricingIntentFromInput(v), now);
      const variant = await tx.productVariant.create({
        data: {
          productId: product.id,
          sku: v.sku,
          title: v.title,
          ...pricing,
          costPriceMinor: v.costPriceMinor ?? null,
          barcode: v.barcode || null,
          attributesJson: JSON.stringify(v.attributes || {}),
        },
      });

      const initialStock = v.initialStock || 0;
      await tx.inventoryLevel.create({
        data: {
          variantId: variant.id,
          sellerOrgId,
          availableUnits: initialStock,
          lowStockThreshold: v.lowStockThreshold ?? 5,
        },
      });

      if (initialStock > 0) {
        await tx.inventoryAdjustment.create({
          data: {
            variantId: variant.id,
            sellerOrgId,
            actorUserId,
            deltaUnits: initialStock,
            balanceAfter: initialStock,
            reasonCode: InventoryAdjustmentReason.RECEIVING,
            notes: "Initial inventory setup on product creation",
          },
        });
      }
    }

    if (actorUserId) {
      await tx.auditEvent.create({
        data: {
          actorUserId,
          entityType: "Product",
          entityId: product.id,
          action: "CREATE_PRODUCT",
          detailsJson: JSON.stringify({ title: input.title, status: finalStatus, moderationStatus: finalModeration }),
        },
      });
    }

    return product;
  });
}

/** Applies a manual stock edit as a delta, recorded in the inventory ledger. */
async function applyStockEdit(
  tx: Prisma.TransactionClient,
  params: {
    variantId: string;
    sku: string;
    sellerOrgId: string;
    desiredUnits: number;
    baselineUnits?: number;
    actorUserId?: string;
    notes: string;
  }
) {
  const level = await tx.inventoryLevel.findUnique({ where: { variantId: params.variantId } });
  if (!level) {
    await tx.inventoryLevel.create({
      data: { variantId: params.variantId, sellerOrgId: params.sellerOrgId, availableUnits: params.desiredUnits },
    });
    if (params.desiredUnits > 0) {
      await tx.inventoryAdjustment.create({
        data: {
          variantId: params.variantId,
          sellerOrgId: params.sellerOrgId,
          actorUserId: params.actorUserId,
          deltaUnits: params.desiredUnits,
          balanceAfter: params.desiredUnits,
          reasonCode: InventoryAdjustmentReason.CYCLE_COUNT,
          notes: params.notes,
        },
      });
    }
    return;
  }

  // Relative to what the seller saw, so orders placed meanwhile are not overwritten
  const delta = params.desiredUnits - (params.baselineUnits ?? level.availableUnits);
  if (delta === 0) return;

  const updated = await tx.inventoryLevel.update({
    where: { variantId: params.variantId },
    data: { availableUnits: { increment: delta } },
  });
  if (updated.availableUnits < updated.reservedUnits || updated.availableUnits < 0) {
    throw new Error(
      `SKU "${params.sku}": stock cannot go below the ${updated.reservedUnits} unit(s) held for open checkouts.`
    );
  }

  await tx.inventoryAdjustment.create({
    data: {
      variantId: params.variantId,
      sellerOrgId: params.sellerOrgId,
      actorUserId: params.actorUserId,
      deltaUnits: delta,
      balanceAfter: updated.availableUnits,
      reasonCode: InventoryAdjustmentReason.CYCLE_COUNT,
      notes: params.notes,
    },
  });
}

/** Writes approved content (product fields, images, variant text, new variants). */
async function applyContentRevision(
  tx: Prisma.TransactionClient,
  params: {
    productId: string;
    sellerOrgId: string;
    revision: StagedRevision;
    existingVariantIds: Set<string>;
    fallbackTitle: string;
    actorUserId?: string;
    now: Date;
  }
) {
  const { productId, sellerOrgId, revision, existingVariantIds, now } = params;

  await tx.product.update({
    where: { id: productId },
    data: {
      title: revision.title,
      slug: revision.slug,
      description: revision.description,
      categoryId: revision.categoryId,
      brandId: revision.brandId,
      metaTitle: revision.metaTitle,
      metaDescription: revision.metaDescription,
      attributesJson: revision.attributes ? JSON.stringify(revision.attributes) : undefined,
      weightGrams: revision.weightGrams,
      lengthMm: revision.lengthMm,
      widthMm: revision.widthMm,
      heightMm: revision.heightMm,
    },
  });

  if (revision.images) {
    await tx.productMedia.deleteMany({ where: { productId } });
    if (revision.images.length > 0) {
      await tx.productMedia.createMany({
        data: normalizeImages(revision.images, revision.title || params.fallbackTitle).map((img) => ({ ...img, productId })),
      });
    }
  }

  const variantContent =
    revision.variantContent ??
    // Legacy staged payloads: only text fields of the product's own variants are applied
    (revision.variants ?? [])
      .filter((v) => v.id)
      .map((v) => ({ id: v.id!, title: v.title, sku: v.sku, barcode: v.barcode ?? null, attributes: v.attributes ?? {} }));

  for (const vc of variantContent) {
    if (!existingVariantIds.has(vc.id)) continue;
    await tx.productVariant.update({
      where: { id: vc.id },
      data: { title: vc.title, sku: vc.sku, barcode: vc.barcode, attributesJson: JSON.stringify(vc.attributes) },
    });
  }

  for (const nv of revision.newVariants ?? []) {
    const intent = pricingIntentFromInput({
      priceMinor: nv.priceMinor,
      compareAtPriceMinor: nv.compareAtPriceMinor,
      dealPriceMinor: nv.dealPriceMinor,
      dealStartsAt: nv.dealStartsAt ? new Date(nv.dealStartsAt) : null,
      dealEndsAt: nv.dealEndsAt ? new Date(nv.dealEndsAt) : null,
    });
    const created = await tx.productVariant.create({
      data: {
        productId,
        title: nv.title,
        sku: nv.sku,
        ...resolveVariantPricing(intent, now),
        costPriceMinor: nv.costPriceMinor ?? null,
        barcode: nv.barcode || null,
        attributesJson: JSON.stringify(nv.attributes || {}),
        isActive: nv.isActive ?? true,
      },
    });
    const opening = nv.availableUnits ?? 0;
    await tx.inventoryLevel.create({
      data: {
        variantId: created.id,
        sellerOrgId,
        availableUnits: opening,
        lowStockThreshold: nv.lowStockThreshold ?? 5,
      },
    });
    if (opening > 0) {
      await tx.inventoryAdjustment.create({
        data: {
          variantId: created.id,
          sellerOrgId,
          actorUserId: params.actorUserId,
          deltaUnits: opening,
          balanceAfter: opening,
          reasonCode: InventoryAdjustmentReason.RECEIVING,
          notes: "Opening stock for new variant",
        },
      });
    }
  }
}

/**
 * Updates a seller product.
 *
 * - Commercial fields (price, "was" price, deal, cost, stock, low-stock alert, on/off,
 *   removing variants) apply immediately.
 * - Content (title, description, images, category, brand, specs, SEO, variant names/SKUs,
 *   new variants) of an approved external listing is staged in pendingChangesJson for
 *   platform review, so shoppers keep seeing the approved version.
 * - Sellers can never set PUBLISHED/approved directly; publishing goes through review
 *   (first-party WIZZ.PK listings excepted).
 */
export async function updateSellerProduct(
  sellerOrgId: string,
  productId: string,
  rawInput: UpdateProductInput,
  actorUserId?: string
) {
  const existing = await getSellerProductById(sellerOrgId, productId);
  const input = parseInput(updateProductSchema, rawInput);
  const sellerOrg = await prisma.sellerOrg.findUnique({ where: { id: sellerOrgId } });
  if (!sellerOrg) throw new Error("Seller organization not found.");

  const now = new Date();
  const firstParty = isFirstPartySeller(sellerOrg);
  const wantsPublish = Boolean(input.submitForReview) || input.status === ProductStatus.PUBLISHED;
  if (wantsPublish && sellerOrg.operationalStatus !== SellerOperationalStatus.ACTIVE) {
    throw new Error("Sellers cannot publish products until their organization application is approved and active.");
  }

  const existingById = new Map(existing.variants.map((v) => [v.id, v]));
  if (input.variants) {
    // Re-adding the SKU of a previously removed variant brings that variant back
    const inactiveBySku = new Map(
      existing.variants.filter((v) => !v.isActive).map((v) => [v.sku.toUpperCase(), v.id])
    );
    input.variants = input.variants.map((v) => {
      const revivedId = !v.id ? inactiveBySku.get(v.sku.toUpperCase()) : undefined;
      return revivedId ? { ...v, id: revivedId, isActive: true } : v;
    });
  }
  if (input.variants) {
    for (const v of input.variants) {
      if (v.id && !existingById.has(v.id)) {
        throw new Error(`FORBIDDEN: Variant ${v.id} does not belong to this product.`);
      }
    }
    validateVariants(input.variants.map((v) => ({ ...v, initialStock: v.availableUnits })));
    for (const v of input.variants) {
      const intent = pricingIntentFromInput(v);
      const stored = v.id ? getPricingIntent(existingById.get(v.id)!) : null;
      validatePricingIntent(intent, `Variant "${v.sku}"`, { now, isNewDeal: !stored || !sameDeal(intent, stored) });
    }
    await assertSkusAvailable(input.variants.map((v) => v.sku), productId);
  }
  await assertCatalogReferences(input.categoryId, input.brandId);

  // ---- Work out which content fields actually change ----
  const revision: StagedRevision = {};
  if (input.title !== undefined && input.title !== existing.title) revision.title = input.title;
  if (input.slug) {
    const wanted = slugify(input.slug);
    if (wanted && wanted !== existing.slug) revision.slug = await findAvailableSlug(wanted, productId);
  }
  if (input.description !== undefined && input.description !== existing.description) revision.description = input.description;
  if (input.categoryId !== undefined && input.categoryId !== existing.categoryId) revision.categoryId = input.categoryId;
  if (input.brandId !== undefined && (input.brandId || null) !== existing.brandId) revision.brandId = input.brandId || null;
  if (input.metaTitle !== undefined && (input.metaTitle || null) !== existing.metaTitle) revision.metaTitle = input.metaTitle || null;
  if (input.metaDescription !== undefined && (input.metaDescription || null) !== existing.metaDescription)
    revision.metaDescription = input.metaDescription || null;
  if (input.attributes && !attrsEqual(input.attributes, stableAttrs(existing.attributesJson))) revision.attributes = input.attributes;
  for (const dim of ["weightGrams", "lengthMm", "widthMm", "heightMm"] as const) {
    if (input[dim] !== undefined && input[dim] !== existing[dim]) revision[dim] = input[dim];
  }
  if (input.images) {
    const next = normalizeImages(input.images, input.title || existing.title);
    const current = existing.media;
    const same =
      next.length === current.length &&
      next.every((img, i) => img.url === current[i].url && img.altText === (current[i].altText || "") && img.isThumbnail === current[i].isThumbnail);
    if (!same) revision.images = next;
  }
  if (input.variants) {
    const variantContent = input.variants
      .filter((v) => v.id)
      .map((v) => ({ id: v.id!, title: v.title, sku: v.sku, barcode: v.barcode || null, attributes: v.attributes ?? stableAttrs(existingById.get(v.id!)!.attributesJson) }))
      .filter((vc) => {
        const cur = existingById.get(vc.id)!;
        return cur.title !== vc.title || cur.sku !== vc.sku || (cur.barcode || null) !== vc.barcode || !attrsEqual(stableAttrs(cur.attributesJson), vc.attributes);
      });
    if (variantContent.length) revision.variantContent = variantContent;
    const newVariants = input.variants.filter((v) => !v.id);
    if (newVariants.length) revision.newVariants = newVariants;
  }
  const contentChanged = Object.keys(revision).length > 0;

  // Content of an approved external listing needs review before shoppers see it
  const contentNeedsReview = existing.isApprovedByPlatform && !firstParty;

  if (wantsPublish) {
    const description = revision.description ?? existing.description;
    const imageCount = revision.images ? revision.images.length : existing.media.length;
    if (!description.trim()) throw new Error("Add a product description before publishing.");
    if (imageCount === 0) throw new Error("Add at least one product image before publishing.");
  }

  return prisma.$transaction(async (tx) => {
    // ---- 1. Commercial changes, applied immediately ----
    if (input.variants) {
      const keptIds = new Set(input.variants.filter((v) => v.id).map((v) => v.id!));
      for (const v of input.variants) {
        if (!v.id) continue;
        const cur = existingById.get(v.id)!;
        await tx.productVariant.update({
          where: { id: v.id },
          data: {
            ...resolveVariantPricing(pricingIntentFromInput(v), now),
            costPriceMinor: v.costPriceMinor ?? null,
            isActive: v.isActive ?? cur.isActive,
          },
        });
        if (v.availableUnits !== undefined) {
          await applyStockEdit(tx, {
            variantId: v.id,
            sku: cur.sku,
            sellerOrgId,
            desiredUnits: v.availableUnits,
            baselineUnits: v.stockBaseline,
            actorUserId,
            notes: "Stock edited in product editor",
          });
        }
        if (v.lowStockThreshold !== undefined && cur.inventoryLevel && cur.inventoryLevel.lowStockThreshold !== v.lowStockThreshold) {
          await tx.inventoryLevel.update({ where: { variantId: v.id }, data: { lowStockThreshold: v.lowStockThreshold } });
        }
      }
      // Variants removed in the editor stop selling; rows stay for order history
      const removed = existing.variants.filter((v) => !keptIds.has(v.id) && v.isActive).map((v) => v.id);
      if (removed.length) {
        await tx.productVariant.updateMany({ where: { id: { in: removed }, productId }, data: { isActive: false } });
      }
    }

    // ---- 2. Content changes ----
    let pendingChangesJson: string | null | undefined;
    let moderationStatus: ProductModerationStatus | undefined;
    let moderationNotes: string | null | undefined;

    if (contentChanged && contentNeedsReview) {
      pendingChangesJson = JSON.stringify(revision);
      moderationStatus = ProductModerationStatus.PENDING_REVIEW;
      moderationNotes = null;
    } else if (contentChanged) {
      await applyContentRevision(tx, {
        productId,
        sellerOrgId,
        revision,
        existingVariantIds: new Set(existingById.keys()),
        fallbackTitle: existing.title,
        actorUserId,
        now,
      });
    }

    // ---- 3. Listing status ----
    let status: ProductStatus | undefined;
    let isApprovedByPlatform: boolean | undefined;

    if (input.status === ProductStatus.ARCHIVED) {
      status = ProductStatus.ARCHIVED;
    } else if (input.status === ProductStatus.DRAFT && existing.status !== ProductStatus.DRAFT) {
      status = ProductStatus.DRAFT; // take offline; approval is kept for reactivation
    } else if (firstParty && wantsPublish) {
      status = ProductStatus.PUBLISHED;
      isApprovedByPlatform = true;
      moderationStatus = ProductModerationStatus.APPROVED;
      moderationNotes = null;
    } else if (wantsPublish && existing.isApprovedByPlatform) {
      // Only an explicit "put back online" changes visibility; resubmitting edits does not
      if (input.status === ProductStatus.PUBLISHED) status = ProductStatus.PUBLISHED;
      if (input.submitForReview && existing.pendingChangesJson && !contentChanged) {
        moderationStatus = ProductModerationStatus.PENDING_REVIEW;
        moderationNotes = null;
      }
    } else if (wantsPublish) {
      // Never approved: send the listing to platform review
      moderationStatus = ProductModerationStatus.PENDING_REVIEW;
      moderationNotes = null;
    }

    const updated = await tx.product.update({
      where: { id: productId },
      data: { status, isApprovedByPlatform, moderationStatus, moderationNotes, pendingChangesJson },
    });

    if (actorUserId) {
      await tx.auditEvent.create({
        data: {
          actorUserId,
          entityType: "Product",
          entityId: productId,
          action: contentChanged && contentNeedsReview ? "STAGE_PRODUCT_REVISION" : "UPDATE_PRODUCT",
          detailsJson: JSON.stringify({
            productId,
            status: updated.status,
            moderationStatus: updated.moderationStatus,
            stagedFields: contentChanged && contentNeedsReview ? Object.keys(revision) : undefined,
          }),
        },
      });
    }

    return updated;
  });
}

/**
 * Deletes / archives a seller product.
 */
export async function deleteSellerProduct(
  sellerOrgId: string,
  productId: string,
  actorUserId?: string
) {
  await getSellerProductById(sellerOrgId, productId);

  return prisma.$transaction(async (tx) => {
    const updated = await tx.product.update({
      where: { id: productId },
      data: { status: ProductStatus.ARCHIVED },
    });

    if (actorUserId) {
      await tx.auditEvent.create({
        data: {
          actorUserId,
          entityType: "Product",
          entityId: productId,
          action: "ARCHIVE_PRODUCT",
          detailsJson: JSON.stringify({ productId }),
        },
      });
    }

    return updated;
  });
}

/**
 * Platform Admin Product Moderation Review:
 * Approves a new product or merges staged pending changes into the live listing.
 */
export async function approveProductModeration(
  productId: string,
  adminUserId: string,
  notes?: string
) {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: { variants: true, media: true },
  });

  if (!product) {
    throw new Error("Product not found.");
  }

  return prisma.$transaction(async (tx) => {
    if (product.pendingChangesJson) {
      // Merge the staged content revision into the live listing
      let staged: StagedRevision;
      try {
        staged = JSON.parse(product.pendingChangesJson) as StagedRevision;
      } catch {
        throw new Error("Failed applying staged product revisions: the staged revision is unreadable.");
      }
      await applyContentRevision(tx, {
        productId,
        sellerOrgId: product.sellerOrgId,
        revision: staged,
        existingVariantIds: new Set(product.variants.map((v) => v.id)),
        fallbackTitle: product.title,
        actorUserId: adminUserId,
        now: new Date(),
      });
      await tx.product.update({
        where: { id: productId },
        data: {
          isApprovedByPlatform: true,
          moderationStatus: ProductModerationStatus.APPROVED,
          moderationNotes: notes || "Revision approved by platform admin.",
          pendingChangesJson: null,
        },
      });
    } else {
      // Approve initial listing
      await tx.product.update({
        where: { id: productId },
        data: {
          status: ProductStatus.PUBLISHED,
          isApprovedByPlatform: true,
          moderationStatus: ProductModerationStatus.APPROVED,
          moderationNotes: notes || "Listing approved by platform admin.",
        },
      });
    }

    await tx.auditEvent.create({
      data: {
        actorUserId: adminUserId,
        entityType: "Product",
        entityId: productId,
        action: "APPROVE_PRODUCT_MODERATION",
        detailsJson: JSON.stringify({ productId, notes }),
      },
    });

    return tx.product.findUnique({
      where: { id: productId },
      include: { variants: true, media: true },
    });
  });
}

/**
 * Platform Admin Product Moderation Review:
 * Rejects or requests changes on a product / staged revision, recording the exact reason.
 */
export async function rejectProductModeration(
  productId: string,
  reason: string,
  isChangeRequest: boolean,
  adminUserId: string
) {
  if (!reason || reason.trim().length === 0) {
    throw new Error("A rejection reason or change request note is required.");
  }

  const product = await prisma.product.findUnique({
    where: { id: productId },
  });

  if (!product) {
    throw new Error("Product not found.");
  }

  const newStatus = isChangeRequest
    ? ProductModerationStatus.CHANGES_REQUESTED
    : ProductModerationStatus.REJECTED;

  return prisma.$transaction(async (tx) => {
    // If the product was already approved & published, keep status PUBLISHED so live listing isn't broken,
    // but update moderationStatus to reject the staged revision!
    const updated = await tx.product.update({
      where: { id: productId },
      data: {
        moderationStatus: newStatus,
        moderationNotes: reason.trim(),
      },
    });

    await tx.auditEvent.create({
      data: {
        actorUserId: adminUserId,
        entityType: "Product",
        entityId: productId,
        action: isChangeRequest ? "REQUEST_PRODUCT_CHANGES" : "REJECT_PRODUCT",
        detailsJson: JSON.stringify({ productId, reason, moderationStatus: newStatus }),
      },
    });

    return updated;
  });
}

const bulkUpdateSchema = z
  .array(
    z.object({
      variantId: z.string().min(1),
      /** Regular selling price. During a live deal this changes the price restored when it ends. */
      priceMinor: moneyMinor.optional(),
      compareAtPriceMinor: moneyMinor.nullable().optional(),
      stock: z.number().int().min(0, "Stock cannot be negative.").max(MAX_STOCK).optional(),
      /** Stock the seller saw; the edit is applied as a delta from it. */
      stockBaseline: z.number().int().min(0).max(MAX_STOCK).optional(),
      isActive: z.boolean().optional(),
    })
  )
  .min(1, "No updates provided.")
  .max(500, "Update at most 500 variants at a time.");

/**
 * Bulk updates price, "was" price, stock and on/off for variants in a seller's catalog.
 * These are commercial fields, so they apply immediately (no content review).
 */
export async function bulkUpdateSellerVariants(
  sellerOrgId: string,
  rawUpdates: BulkVariantUpdateItem[],
  actorUserId?: string
) {
  const updates = parseInput(bulkUpdateSchema, rawUpdates);

  const variantIds = updates.map((u) => u.variantId);
  if (new Set(variantIds).size !== variantIds.length) {
    throw new Error("Each variant can appear only once per bulk update.");
  }
  const variants = await prisma.productVariant.findMany({
    where: {
      id: { in: variantIds },
      product: { sellerOrgId },
    },
    include: { inventoryLevel: true },
  });

  if (variants.length !== updates.length) {
    throw new Error("FORBIDDEN: One or more variants do not belong to your seller organization.");
  }

  const variantMap = new Map(variants.map((v) => [v.id, v]));
  const now = new Date();

  // Validate everything before writing anything
  const plans = updates.map((u) => {
    const existing = variantMap.get(u.variantId)!;
    const stored = getPricingIntent(existing);
    const intent: SellerPricingIntent = {
      ...stored,
      regularPriceMinor: u.priceMinor ?? stored.regularPriceMinor,
      regularCompareAtMinor: u.compareAtPriceMinor !== undefined ? u.compareAtPriceMinor : stored.regularCompareAtMinor,
    };
    validatePricingIntent(intent, `SKU "${existing.sku}"`, { now });
    return { u, existing, intent };
  });

  return prisma.$transaction(async (tx) => {
    const results = [];

    for (const { u, existing, intent } of plans) {
      const updatedV = await tx.productVariant.update({
        where: { id: u.variantId },
        data: {
          ...resolveVariantPricing(intent, now),
          isActive: u.isActive,
        },
      });

      if (u.stock !== undefined) {
        await applyStockEdit(tx, {
          variantId: u.variantId,
          sku: existing.sku,
          sellerOrgId,
          desiredUnits: u.stock,
          baselineUnits: u.stockBaseline,
          actorUserId,
          notes: "Bulk price/stock update",
        });
      }

      results.push(updatedV);
    }

    if (actorUserId) {
      await tx.auditEvent.create({
        data: {
          actorUserId,
          entityType: "SellerOrg",
          entityId: sellerOrgId,
          action: "BULK_UPDATE_VARIANTS",
          detailsJson: JSON.stringify({ count: updates.length }),
        },
      });
    }

    return results;
  });
}

/**
 * CSV Import Engine:
 * Validates row-by-row, provides preview with per-row errors, and applies transactional upserts
 * matched on SKU within the seller's catalog.
 */
export async function importSellerProductsCsv(
  sellerOrgId: string,
  rows: CsvProductRow[],
  options: { dryRun?: boolean } = {},
  actorUserId?: string
): Promise<CsvImportResult> {
  const result: CsvImportResult = {
    totalRows: rows.length,
    validCount: 0,
    errorCount: 0,
    createdProducts: 0,
    updatedVariants: 0,
    createdVariants: 0,
    errors: [],
    previewRows: [],
  };

  const sellerOrg = await prisma.sellerOrg.findUnique({
    where: { id: sellerOrgId },
  });

  if (!sellerOrg) {
    throw new Error("Seller organization not found.");
  }

  // Pre-load all existing categories for category slug/name matching
  const categories = await prisma.category.findMany();
  const categoryMap = new Map<string, string>();
  for (const c of categories) {
    categoryMap.set(c.slug.toLowerCase(), c.id);
    categoryMap.set(c.name.toLowerCase(), c.id);
  }

  // Pre-load seller's existing variants
  const sellerVariants = await prisma.productVariant.findMany({
    where: { product: { sellerOrgId } },
    include: { product: true, inventoryLevel: true },
  });
  const sellerVariantMap = new Map(sellerVariants.map((v) => [v.sku.toUpperCase(), v]));

  // Track SKUs seen in this batch to prevent duplicate SKUs inside the uploaded CSV
  const seenBatchSkus = new Set<string>();

  interface ValidatedRow {
    rowNumber: number;
    sku: string;
    action: "CREATE" | "UPDATE";
    title: string;
    description?: string;
    categoryId: string;
    variantTitle: string;
    priceMinor: number;
    compareAtPriceMinor: number | null;
    stock: number;
    barcode?: string;
    attributes: Record<string, string>;
    existingVariantId?: string;
    existingProductId?: string;
  }

  const validatedRows: ValidatedRow[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 1;
    const rawSku = (row.sku || "").trim();

    if (!rawSku) {
      result.errorCount++;
      result.errors.push({ row: rowNum, message: "Missing required SKU." });
      result.previewRows?.push({
        row: rowNum,
        sku: "—",
        title: row.title || "—",
        pricePkr: row.pricePkr || 0,
        stock: row.stock || 0,
        action: "CREATE",
        isValid: false,
        error: "Missing required SKU.",
      });
      continue;
    }

    const normSku = rawSku.toUpperCase();
    if (seenBatchSkus.has(normSku)) {
      result.errorCount++;
      result.errors.push({ row: rowNum, sku: rawSku, message: `Duplicate SKU "${rawSku}" within CSV file.` });
      result.previewRows?.push({
        row: rowNum,
        sku: rawSku,
        title: row.title || "—",
        pricePkr: row.pricePkr || 0,
        stock: row.stock || 0,
        action: "CREATE",
        isValid: false,
        error: "Duplicate SKU within CSV.",
      });
      continue;
    }
    seenBatchSkus.add(normSku);

    // Check if SKU belongs to ANOTHER seller
    const otherSellerVariant = await prisma.productVariant.findFirst({
      where: {
        sku: rawSku,
        product: { sellerOrgId: { not: sellerOrgId } },
      },
    });

    if (otherSellerVariant) {
      result.errorCount++;
      result.errors.push({
        row: rowNum,
        sku: rawSku,
        message: `SKU "${rawSku}" is owned by another merchant in the marketplace.`,
      });
      result.previewRows?.push({
        row: rowNum,
        sku: rawSku,
        title: row.title || "—",
        pricePkr: row.pricePkr || 0,
        stock: row.stock || 0,
        action: "UPDATE",
        isValid: false,
        error: "SKU belongs to another merchant.",
      });
      continue;
    }

    // Validate Price
    const pricePkr = Number(row.pricePkr);
    if (isNaN(pricePkr) || pricePkr < 0) {
      result.errorCount++;
      result.errors.push({
        row: rowNum,
        sku: rawSku,
        message: "Invalid price: must be a positive number.",
      });
      result.previewRows?.push({
        row: rowNum,
        sku: rawSku,
        title: row.title || "—",
        pricePkr: 0,
        stock: row.stock || 0,
        action: "CREATE",
        isValid: false,
        error: "Invalid price: must be positive.",
      });
      continue;
    }
    const priceMinor = Math.round(pricePkr * 100);

    // Validate Compare-At Price
    let compareAtPriceMinor: number | null = null;
    if (row.compareAtPricePkr != null && row.compareAtPricePkr !== 0) {
      const comparePkr = Number(row.compareAtPricePkr);
      if (isNaN(comparePkr) || comparePkr <= pricePkr) {
        result.errorCount++;
        result.errors.push({
          row: rowNum,
          sku: rawSku,
          message: `Compare-at price (${comparePkr}) must be strictly greater than selling price (${pricePkr}).`,
        });
        result.previewRows?.push({
          row: rowNum,
          sku: rawSku,
          title: row.title || "—",
          pricePkr,
          compareAtPricePkr: comparePkr,
          stock: row.stock || 0,
          action: "CREATE",
          isValid: false,
          error: "Compare-at price must exceed selling price.",
        });
        continue;
      }
      compareAtPriceMinor = Math.round(comparePkr * 100);
    }

    // Validate Stock
    const stock = Number(row.stock !== undefined ? row.stock : 0);
    if (isNaN(stock) || stock < 0) {
      result.errorCount++;
      result.errors.push({
        row: rowNum,
        sku: rawSku,
        message: "Stock cannot be negative.",
      });
      result.previewRows?.push({
        row: rowNum,
        sku: rawSku,
        title: row.title || "—",
        pricePkr,
        stock: -1,
        action: "CREATE",
        isValid: false,
        error: "Stock cannot be negative.",
      });
      continue;
    }

    // Determine Action: UPDATE existing variant vs CREATE new product/variant
    const existingV = sellerVariantMap.get(normSku);
    const action: "CREATE" | "UPDATE" = existingV ? "UPDATE" : "CREATE";

    let categoryId = existingV ? existingV.product.categoryId : categories[0]?.id;
    if (row.category && row.category.trim()) {
      const matchedCat = categoryMap.get(row.category.trim().toLowerCase());
      if (matchedCat) {
        categoryId = matchedCat;
      }
    }

    const title = row.title ? row.title.trim() : existingV?.product.title || `Product ${rawSku}`;

    validatedRows.push({
      rowNumber: rowNum,
      sku: rawSku,
      action,
      title,
      description: row.description || existingV?.product.description || "Imported product listing",
      categoryId,
      variantTitle: row.variantTitle ? row.variantTitle.trim() : existingV?.title || "Standard",
      priceMinor,
      compareAtPriceMinor,
      stock,
      barcode: row.barcode || existingV?.barcode || undefined,
      attributes: row.attributes || {},
      existingVariantId: existingV?.id,
      existingProductId: existingV?.productId,
    });

    result.validCount++;
    result.previewRows?.push({
      row: rowNum,
      sku: rawSku,
      title,
      pricePkr,
      compareAtPricePkr: row.compareAtPricePkr,
      stock,
      action,
      isValid: true,
    });
  }

  // If dryRun mode, return preview without committing writes
  if (options.dryRun) {
    return result;
  }

  // Commit writes transactionally
  const importingOrg = await prisma.sellerOrg.findUnique({ where: { id: sellerOrgId }, select: { id: true, slug: true } });
  const importerIsFirstParty = importingOrg ? isFirstPartySeller(importingOrg) : false;
  const importNow = new Date();

  return prisma.$transaction(async (tx) => {
    for (const vRow of validatedRows) {
      if (vRow.action === "UPDATE" && vRow.existingVariantId) {
        const current = await tx.productVariant.findUniqueOrThrow({
          where: { id: vRow.existingVariantId },
          include: { product: { select: { isApprovedByPlatform: true } } },
        });
        // CSV prices are the seller's regular prices; a live deal keeps running on top
        const intent: SellerPricingIntent = {
          ...getPricingIntent(current),
          regularPriceMinor: vRow.priceMinor,
          regularCompareAtMinor: vRow.compareAtPriceMinor,
        };
        validatePricingIntent(intent, `Row SKU "${vRow.sku}"`, { now: importNow });
        // Renaming variants of an approved external listing needs review, so CSV leaves names alone there
        const canEditContent = importerIsFirstParty || !current.product.isApprovedByPlatform;

        await tx.productVariant.update({
          where: { id: vRow.existingVariantId },
          data: {
            ...resolveVariantPricing(intent, importNow),
            ...(canEditContent ? { title: vRow.variantTitle, barcode: vRow.barcode || null } : {}),
          },
        });

        // The CSV stock column is a stock count: set on-hand to it, via the ledger
        await applyStockEdit(tx, {
          variantId: vRow.existingVariantId,
          sku: vRow.sku,
          sellerOrgId,
          desiredUnits: vRow.stock,
          actorUserId,
          notes: "CSV Import inventory sync",
        });

        result.updatedVariants++;
      } else {
        // Create new product + variant
        const slug = `${vRow.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}-${Date.now().toString().slice(-6)}`;

        const product = await tx.product.create({
          data: {
            sellerOrgId,
            title: vRow.title,
            slug,
            description: vRow.description || "Imported catalog item",
            categoryId: vRow.categoryId,
            status: ProductStatus.DRAFT,
            moderationStatus: ProductModerationStatus.DRAFT,
          },
        });

        const createdV = await tx.productVariant.create({
          data: {
            productId: product.id,
            sku: vRow.sku,
            title: vRow.variantTitle,
            priceMinor: vRow.priceMinor,
            compareAtPriceMinor: vRow.compareAtPriceMinor,
            barcode: vRow.barcode || null,
            attributesJson: JSON.stringify(vRow.attributes),
          },
        });

        await tx.inventoryLevel.create({
          data: {
            variantId: createdV.id,
            sellerOrgId,
            availableUnits: vRow.stock,
          },
        });

        if (vRow.stock > 0) {
          await tx.inventoryAdjustment.create({
            data: {
              variantId: createdV.id,
              sellerOrgId,
              actorUserId,
              deltaUnits: vRow.stock,
              balanceAfter: vRow.stock,
              reasonCode: InventoryAdjustmentReason.RECEIVING,
              notes: "CSV Import initial stock intake",
            },
          });
        }

        result.createdProducts++;
        result.createdVariants++;
      }
    }

    if (actorUserId) {
      await tx.auditEvent.create({
        data: {
          actorUserId,
          entityType: "SellerOrg",
          entityId: sellerOrgId,
          action: "CSV_IMPORT_CATALOG",
          detailsJson: JSON.stringify({
            totalRows: result.totalRows,
            validCount: result.validCount,
            errorCount: result.errorCount,
          }),
        },
      });
    }

    return result;
  });
}

/**
 * Retrieves inventory balances for all variants belonging to a seller organization.
 */
export async function getSellerInventory(
  sellerOrgId: string,
  options: { lowStockOnly?: boolean; query?: string; page?: number; limit?: number } = {}
) {
  const { lowStockOnly, query, page = 1, limit = 25 } = options;

  const where: Record<string, unknown> = {
    sellerOrgId,
  };

  if (query && query.trim().length > 0) {
    const q = query.trim();
    where.variant = {
      OR: [
        { sku: { contains: q, mode: "insensitive" } },
        { title: { contains: q, mode: "insensitive" } },
        { product: { title: { contains: q, mode: "insensitive" } } },
      ],
    };
  }

  const levels = await prisma.inventoryLevel.findMany({
    where,
    skip: (page - 1) * limit,
    take: limit,
    orderBy: { updatedAt: "desc" },
    include: {
      variant: {
        include: {
          product: { select: { id: true, title: true, status: true, media: { take: 1 } } },
        },
      },
    },
  });

  const total = await prisma.inventoryLevel.count({ where });

  const mapped = levels.map((lvl) => ({
    id: lvl.id,
    variantId: lvl.variantId,
    productId: lvl.variant.product.id,
    productTitle: lvl.variant.product.title,
    variantTitle: lvl.variant.title,
    sku: lvl.variant.sku,
    availableUnits: lvl.availableUnits,
    reservedUnits: lvl.reservedUnits,
    lowStockThreshold: lvl.lowStockThreshold,
    isLowStock: lvl.availableUnits <= lvl.lowStockThreshold,
    thumbnailUrl: lvl.variant.product.media[0]?.url || null,
    updatedAt: lvl.updatedAt,
  }));

  const filtered = lowStockOnly ? mapped.filter((m) => m.isLowStock) : mapped;

  return {
    items: filtered,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

/**
 * Adjusts stock balance for a seller's variant.
 * Enforces that the variant belongs to the seller.
 */
export async function adjustSellerInventory(
  sellerOrgId: string,
  variantId: string,
  deltaUnits: number,
  reasonCode: InventoryAdjustmentReason,
  notes?: string,
  actorUserId?: string
) {
  const level = await prisma.inventoryLevel.findUnique({
    where: { variantId },
    include: { variant: { include: { product: true } } },
  });

  if (!level || level.sellerOrgId !== sellerOrgId) {
    throw new Error(`FORBIDDEN: Variant ${variantId} does not belong to your seller organization.`);
  }

  if (!Number.isInteger(deltaUnits) || deltaUnits === 0) {
    throw new Error("Adjustment must be a non-zero whole number of units.");
  }
  if (level.availableUnits + deltaUnits < 0) {
    throw new Error(`Cannot decrease stock below zero. Current available: ${level.availableUnits}`);
  }

  return prisma.$transaction(async (tx) => {
    // Atomic increment so concurrent checkouts are never overwritten
    const updatedLevel = await tx.inventoryLevel.update({
      where: { variantId },
      data: { availableUnits: { increment: deltaUnits } },
    });
    const newBalance = updatedLevel.availableUnits;
    if (newBalance < 0 || newBalance < updatedLevel.reservedUnits) {
      throw new Error(
        `Cannot reduce stock below the ${updatedLevel.reservedUnits} unit(s) held for open checkouts. Current on hand: ${level.availableUnits}`
      );
    }

    const adjustment = await tx.inventoryAdjustment.create({
      data: {
        variantId,
        sellerOrgId,
        actorUserId,
        deltaUnits,
        balanceAfter: newBalance,
        reasonCode,
        notes: notes || null,
      },
    });

    // Check low stock alert
    if (newBalance <= level.lowStockThreshold && deltaUnits < 0) {
      const ownerMembership = await tx.sellerMembership.findFirst({
        where: { sellerOrgId, role: "OWNER", isActive: true },
      });
      if (ownerMembership) {
        await tx.notification.create({
          data: {
            userId: ownerMembership.userId,
            sellerOrgId,
            title: "Low Stock Alert",
            message: `SKU "${level.variant.sku}" has dropped to ${newBalance} units (Threshold: ${level.lowStockThreshold}).`,
            type: "INVENTORY",
            linkUrl: "/seller/portal/inventory",
          },
        });
      }
    }

    return { updatedLevel, adjustment };
  });
}
