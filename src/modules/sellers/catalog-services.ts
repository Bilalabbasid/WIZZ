import { prisma } from "@/lib/db";
import {
  ProductStatus,
  ProductModerationStatus,
  InventoryAdjustmentReason,
  SellerOperationalStatus,
} from "@prisma/client";

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
}

export interface CreateProductInput {
  title: string;
  slug?: string;
  description: string;
  categoryId: string;
  brandId?: string | null;
  status?: ProductStatus;
  metaTitle?: string | null;
  metaDescription?: string | null;
  attributes?: Record<string, string>;
  submitForReview?: boolean;
  weightGrams?: number;
  lengthMm?: number;
  widthMm?: number;
  heightMm?: number;
  images?: Array<{
    url: string;
    altText?: string;
    isThumbnail?: boolean;
    displayOrder?: number;
  }>;
  variants: CreateProductVariantInput[];
}

export interface UpdateProductInput {
  title?: string;
  slug?: string;
  description?: string;
  categoryId?: string;
  brandId?: string | null;
  status?: ProductStatus;
  metaTitle?: string | null;
  metaDescription?: string | null;
  attributes?: Record<string, string>;
  submitForReview?: boolean;
  stageEditsIfPublished?: boolean;
  weightGrams?: number;
  lengthMm?: number;
  widthMm?: number;
  heightMm?: number;
  images?: Array<{
    url: string;
    altText?: string;
    isThumbnail?: boolean;
    displayOrder?: number;
  }>;
  variants?: Array<{
    id?: string;
    title: string;
    sku: string;
    priceMinor: number;
    compareAtPriceMinor?: number | null;
    costPriceMinor?: number | null;
    barcode?: string | null;
    attributes?: Record<string, string>;
    isActive?: boolean;
    availableUnits?: number;
  }>;
}

export interface BulkVariantUpdateItem {
  variantId: string;
  priceMinor?: number;
  compareAtPriceMinor?: number | null;
  stock?: number;
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
    page?: number;
    limit?: number;
  } = {}
) {
  const { query, status, moderationStatus, categoryId, page = 1, limit = 20 } = options;
  const where: Record<string, unknown> = {
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

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        category: true,
        brand: true,
        media: { orderBy: { displayOrder: "asc" } },
        variants: {
          include: { inventoryLevel: true },
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
 * Creates a new seller product with variants and media.
 * SERVER RULE: If the seller organization is not ACTIVE, the status cannot be PUBLISHED.
 */
export async function createSellerProduct(
  sellerOrgId: string,
  input: CreateProductInput,
  actorUserId?: string
) {
  const sellerOrg = await prisma.sellerOrg.findUnique({
    where: { id: sellerOrgId },
  });

  if (!sellerOrg) {
    throw new Error("Seller organization not found.");
  }

  // Validate variant rules
  validateVariants(input.variants);

  // Check SKU collisions across the entire database
  const skus = input.variants.map((v) => v.sku.trim());
  const existingVariants = await prisma.productVariant.findMany({
    where: { sku: { in: skus } },
    select: { sku: true },
  });
  if (existingVariants.length > 0) {
    throw new Error(`SKU already exists in the catalog: "${existingVariants[0].sku}". SKUs must be unique.`);
  }

  // Server-enforced rule: unapproved/inactive sellers cannot publish
  let finalStatus: ProductStatus = input.status || ProductStatus.DRAFT;
  let finalModeration: ProductModerationStatus = ProductModerationStatus.DRAFT;

  if (finalStatus === ProductStatus.PUBLISHED || input.submitForReview) {
    if (sellerOrg.operationalStatus !== SellerOperationalStatus.ACTIVE) {
      throw new Error(
        "Sellers cannot publish products until their organization application is approved and active. You may save this product as DRAFT."
      );
    }
    finalModeration = ProductModerationStatus.APPROVED;
    finalStatus = ProductStatus.PUBLISHED;
  }

  const slugBase = (input.slug || input.title)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  const uniqueSlug = `${slugBase}-${Date.now().toString().slice(-6)}`;

  return prisma.$transaction(async (tx) => {
    const product = await tx.product.create({
      data: {
        sellerOrgId,
        title: input.title.trim(),
        slug: uniqueSlug,
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

    // Create media
    if (input.images && input.images.length > 0) {
      for (let i = 0; i < input.images.length; i++) {
        const img = input.images[i];
        await tx.productMedia.create({
          data: {
            productId: product.id,
            url: img.url,
            altText: img.altText || input.title,
            displayOrder: img.displayOrder !== undefined ? img.displayOrder : i,
            isThumbnail: img.isThumbnail ?? i === 0,
          },
        });
      }
    }

    // Create variants and inventory levels
    for (const v of input.variants) {
      const variant = await tx.productVariant.create({
        data: {
          productId: product.id,
          sku: v.sku.trim(),
          title: v.title.trim(),
          priceMinor: v.priceMinor,
          compareAtPriceMinor: v.compareAtPriceMinor || null,
          costPriceMinor: v.costPriceMinor || null,
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
          lowStockThreshold: v.lowStockThreshold || 5,
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

/**
 * Updates a seller product.
 * Enforces tenant isolation, input validations, and publication boundaries.
 * 
 * REVIEW STAGING RULE:
 * If the product is already PUBLISHED and approved, edits to public content
 * (title, description, media, etc.) are staged into pendingChangesJson with
 * moderationStatus = PENDING_REVIEW so approved public content is NOT accidentally overwritten.
 */
export async function updateSellerProduct(
  sellerOrgId: string,
  productId: string,
  input: UpdateProductInput,
  actorUserId?: string
) {
  const existing = await getSellerProductById(sellerOrgId, productId);
  const sellerOrg = await prisma.sellerOrg.findUnique({ where: { id: sellerOrgId } });

  // Validate variant inputs if provided
  if (input.variants) {
    validateVariants(
      input.variants.map((v) => ({
        title: v.title,
        sku: v.sku,
        priceMinor: v.priceMinor,
        compareAtPriceMinor: v.compareAtPriceMinor,
        costPriceMinor: v.costPriceMinor,
        barcode: v.barcode,
        attributes: v.attributes,
        initialStock: v.availableUnits,
      }))
    );

    // Check SKU collisions with other products
    for (const v of input.variants) {
      const otherVariant = await prisma.productVariant.findFirst({
        where: {
          sku: v.sku.trim(),
          productId: { not: productId },
        },
      });
      if (otherVariant) {
        throw new Error(`SKU "${v.sku}" is already in use by another product.`);
      }
    }
  }

  if (input.status === ProductStatus.PUBLISHED || input.submitForReview) {
    if (sellerOrg?.operationalStatus !== SellerOperationalStatus.ACTIVE) {
      throw new Error(
        "Sellers cannot publish products until their organization application is approved and active."
      );
    }
  }

  // Check if this product is already PUBLISHED and live
  const isCurrentlyPublished = existing.status === ProductStatus.PUBLISHED && existing.isApprovedByPlatform;
  const shouldStageEdits = isCurrentlyPublished && input.stageEditsIfPublished !== false;

  if (shouldStageEdits) {
    // Stage the pending revisions safely in pendingChangesJson
    return prisma.$transaction(async (tx) => {
      const updated = await tx.product.update({
        where: { id: productId },
        data: {
          pendingChangesJson: JSON.stringify(input),
          moderationStatus: ProductModerationStatus.PENDING_REVIEW,
          moderationNotes: null, // Clear past rejection notes upon resubmission
        },
      });

      if (actorUserId) {
        await tx.auditEvent.create({
          data: {
            actorUserId,
            entityType: "Product",
            entityId: productId,
            action: "STAGE_PRODUCT_REVISION",
            detailsJson: JSON.stringify({
              productId,
              message: "Submitted pending changes for review; live content preserved.",
            }),
          },
        });
      }

      return updated;
    });
  }

  // Direct draft update or un-staged update
  return prisma.$transaction(async (tx) => {
    let finalModeration = existing.moderationStatus;
    const finalStatus = input.status !== undefined ? input.status : existing.status;

    if (input.submitForReview) {
      finalModeration = ProductModerationStatus.PENDING_REVIEW;
    } else if (input.status === ProductStatus.DRAFT) {
      finalModeration = ProductModerationStatus.DRAFT;
    }

    const updated = await tx.product.update({
      where: { id: productId },
      data: {
        title: input.title !== undefined ? input.title.trim() : undefined,
        slug: input.slug ? input.slug.trim().toLowerCase() : undefined,
        description: input.description,
        categoryId: input.categoryId,
        brandId: input.brandId,
        status: finalStatus,
        isApprovedByPlatform: finalStatus === ProductStatus.PUBLISHED ? true : undefined,
        moderationStatus: finalModeration,
        moderationNotes: input.submitForReview ? null : undefined,
        metaTitle: input.metaTitle !== undefined ? input.metaTitle : undefined,
        metaDescription: input.metaDescription !== undefined ? input.metaDescription : undefined,
        attributesJson: input.attributes ? JSON.stringify(input.attributes) : undefined,
        weightGrams: input.weightGrams,
        lengthMm: input.lengthMm,
        widthMm: input.widthMm,
        heightMm: input.heightMm,
      },
    });

    // Update media if provided
    if (input.images) {
      await tx.productMedia.deleteMany({ where: { productId } });
      for (let i = 0; i < input.images.length; i++) {
        const img = input.images[i];
        await tx.productMedia.create({
          data: {
            productId,
            url: img.url,
            altText: img.altText || updated.title,
            displayOrder: img.displayOrder !== undefined ? img.displayOrder : i,
            isThumbnail: img.isThumbnail ?? i === 0,
          },
        });
      }
    }

    // Update variants if provided
    if (input.variants) {
      for (const v of input.variants) {
        if (v.id) {
          await tx.productVariant.update({
            where: { id: v.id },
            data: {
              title: v.title.trim(),
              sku: v.sku.trim(),
              priceMinor: v.priceMinor,
              compareAtPriceMinor: v.compareAtPriceMinor || null,
              costPriceMinor: v.costPriceMinor || null,
              barcode: v.barcode || null,
              attributesJson: v.attributes ? JSON.stringify(v.attributes) : undefined,
              isActive: v.isActive,
            },
          });
          if (v.availableUnits !== undefined && v.availableUnits >= 0) {
            await tx.inventoryLevel.upsert({
              where: { variantId: v.id },
              update: { availableUnits: v.availableUnits },
              create: {
                variantId: v.id,
                sellerOrgId,
                availableUnits: v.availableUnits,
              },
            });
          }
        } else {
          const createdV = await tx.productVariant.create({
            data: {
              productId,
              title: v.title.trim(),
              sku: v.sku.trim(),
              priceMinor: v.priceMinor,
              compareAtPriceMinor: v.compareAtPriceMinor || null,
              costPriceMinor: v.costPriceMinor || null,
              barcode: v.barcode || null,
              attributesJson: JSON.stringify(v.attributes || {}),
            },
          });
          await tx.inventoryLevel.create({
            data: {
              variantId: createdV.id,
              sellerOrgId,
              availableUnits: v.availableUnits || 0,
              lowStockThreshold: 5,
            },
          });
        }
      }
    }

    if (actorUserId) {
      await tx.auditEvent.create({
        data: {
          actorUserId,
          entityType: "Product",
          entityId: productId,
          action: "UPDATE_PRODUCT",
          detailsJson: JSON.stringify({ productId, status: finalStatus, moderationStatus: finalModeration }),
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
    // If there were staged revisions, apply them to the live listing now!
    if (product.pendingChangesJson) {
      try {
        const staged = JSON.parse(product.pendingChangesJson) as UpdateProductInput;

        await tx.product.update({
          where: { id: productId },
          data: {
            title: staged.title !== undefined ? staged.title.trim() : undefined,
            slug: staged.slug ? staged.slug.trim().toLowerCase() : undefined,
            description: staged.description !== undefined ? staged.description : undefined,
            categoryId: staged.categoryId !== undefined ? staged.categoryId : undefined,
            brandId: staged.brandId !== undefined ? staged.brandId : undefined,
            metaTitle: staged.metaTitle !== undefined ? staged.metaTitle : undefined,
            metaDescription: staged.metaDescription !== undefined ? staged.metaDescription : undefined,
            attributesJson: staged.attributes ? JSON.stringify(staged.attributes) : undefined,
            weightGrams: staged.weightGrams,
            lengthMm: staged.lengthMm,
            widthMm: staged.widthMm,
            heightMm: staged.heightMm,
            status: ProductStatus.PUBLISHED,
            isApprovedByPlatform: true,
            moderationStatus: ProductModerationStatus.APPROVED,
            moderationNotes: notes || "Revision approved by platform admin.",
            pendingChangesJson: null, // Clear staged changes
          },
        });

        if (staged.images) {
          await tx.productMedia.deleteMany({ where: { productId } });
          for (let i = 0; i < staged.images.length; i++) {
            const img = staged.images[i];
            await tx.productMedia.create({
              data: {
                productId,
                url: img.url,
                altText: img.altText || staged.title || product.title,
                displayOrder: img.displayOrder !== undefined ? img.displayOrder : i,
                isThumbnail: img.isThumbnail ?? i === 0,
              },
            });
          }
        }

        if (staged.variants) {
          for (const v of staged.variants) {
            if (v.id) {
              await tx.productVariant.update({
                where: { id: v.id },
                data: {
                  title: v.title.trim(),
                  sku: v.sku.trim(),
                  priceMinor: v.priceMinor,
                  compareAtPriceMinor: v.compareAtPriceMinor || null,
                  costPriceMinor: v.costPriceMinor || null,
                  barcode: v.barcode || null,
                  attributesJson: v.attributes ? JSON.stringify(v.attributes) : undefined,
                  isActive: v.isActive,
                },
              });
            }
          }
        }
      } catch (err) {
        throw new Error(`Failed applying staged product revisions: ${err instanceof Error ? err.message : String(err)}`);
      }
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

/**
 * Bulk updates prices and stock for multiple variants within a seller's catalog.
 * Validates promo price inversion and non-negative stock.
 */
export async function bulkUpdateSellerVariants(
  sellerOrgId: string,
  updates: BulkVariantUpdateItem[],
  actorUserId?: string
) {
  if (!updates || updates.length === 0) {
    throw new Error("No updates provided.");
  }

  const variantIds = updates.map((u) => u.variantId);
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

  // Validate all updates upfront
  for (const u of updates) {
    const existing = variantMap.get(u.variantId)!;
    const finalPrice = u.priceMinor !== undefined ? u.priceMinor : existing.priceMinor;
    const finalCompare =
      u.compareAtPriceMinor !== undefined ? u.compareAtPriceMinor : existing.compareAtPriceMinor;

    if (finalPrice < 0) {
      throw new Error(`Price for SKU "${existing.sku}" cannot be negative.`);
    }

    if (finalCompare != null && finalCompare <= finalPrice) {
      throw new Error(
        `Promotional compare-at price for SKU "${existing.sku}" (${finalCompare / 100}) must be strictly greater than selling price (${finalPrice / 100}).`
      );
    }

    if (u.stock !== undefined && u.stock < 0) {
      throw new Error(`Stock for SKU "${existing.sku}" cannot be negative.`);
    }
  }

  return prisma.$transaction(async (tx) => {
    const results = [];

    for (const u of updates) {
      const existing = variantMap.get(u.variantId)!;

      // Update variant prices
      const updatedV = await tx.productVariant.update({
        where: { id: u.variantId },
        data: {
          priceMinor: u.priceMinor !== undefined ? u.priceMinor : undefined,
          compareAtPriceMinor: u.compareAtPriceMinor !== undefined ? u.compareAtPriceMinor : undefined,
        },
      });

      // Update inventory level if stock provided
      if (u.stock !== undefined) {
        const currentStock = existing.inventoryLevel?.availableUnits || 0;
        const delta = u.stock - currentStock;

        await tx.inventoryLevel.upsert({
          where: { variantId: u.variantId },
          update: { availableUnits: u.stock },
          create: {
            variantId: u.variantId,
            sellerOrgId,
            availableUnits: u.stock,
          },
        });

        if (delta !== 0) {
          await tx.inventoryAdjustment.create({
            data: {
              variantId: u.variantId,
              sellerOrgId,
              actorUserId,
              deltaUnits: delta,
              balanceAfter: u.stock,
              reasonCode: InventoryAdjustmentReason.CYCLE_COUNT,
              notes: "Bulk price/stock batch update",
            },
          });
        }
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
  return prisma.$transaction(async (tx) => {
    for (const vRow of validatedRows) {
      if (vRow.action === "UPDATE" && vRow.existingVariantId) {
        // Update existing variant
        await tx.productVariant.update({
          where: { id: vRow.existingVariantId },
          data: {
            title: vRow.variantTitle,
            priceMinor: vRow.priceMinor,
            compareAtPriceMinor: vRow.compareAtPriceMinor,
            barcode: vRow.barcode || null,
          },
        });

        // Update inventory level
        const currentLevel = await tx.inventoryLevel.findUnique({
          where: { variantId: vRow.existingVariantId },
        });
        const currentStock = currentLevel?.availableUnits || 0;
        const delta = vRow.stock - currentStock;

        await tx.inventoryLevel.upsert({
          where: { variantId: vRow.existingVariantId },
          update: { availableUnits: vRow.stock },
          create: {
            variantId: vRow.existingVariantId,
            sellerOrgId,
            availableUnits: vRow.stock,
          },
        });

        if (delta !== 0) {
          await tx.inventoryAdjustment.create({
            data: {
              variantId: vRow.existingVariantId,
              sellerOrgId,
              actorUserId,
              deltaUnits: delta,
              balanceAfter: vRow.stock,
              reasonCode: InventoryAdjustmentReason.CYCLE_COUNT,
              notes: "CSV Import inventory sync",
            },
          });
        }

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

  const newBalance = level.availableUnits + deltaUnits;
  if (newBalance < 0) {
    throw new Error(`Cannot decrease stock below zero. Current available: ${level.availableUnits}`);
  }

  return prisma.$transaction(async (tx) => {
    const updatedLevel = await tx.inventoryLevel.update({
      where: { variantId },
      data: { availableUnits: newBalance },
    });

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
