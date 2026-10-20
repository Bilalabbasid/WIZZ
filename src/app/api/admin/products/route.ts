import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { UserRole, ProductStatus, InventoryAdjustmentReason } from "@prisma/client";
import { prisma } from "@/lib/db";
import { SITE_CONFIG } from "@/lib/config";

export async function POST(req: NextRequest) {
  try {
    const admin = await requireRole([
      UserRole.PLATFORM_SUPER_ADMIN,
      UserRole.PLATFORM_CATALOG_ADMIN,
    ]);

    const {
      title,
      description,
      categoryId,
      brandId,
      featured = false,
      weightGrams = 500,
      initialSku,
      variantTitle = "Standard",
      priceMinor,
      compareAtPriceMinor,
      initialStock = 10,
      imageUrl,
    } = await req.json();

    if (!title || !description || !categoryId || !initialSku || !priceMinor) {
      return NextResponse.json(
        { error: "Title, description, categoryId, initialSku, and price are required." },
        { status: 400 }
      );
    }

    const slug = `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}-${Date.now().toString().slice(-4)}`;

    const product = await prisma.$transaction(async (tx) => {
      const p = await tx.product.create({
        data: {
          sellerOrgId: SITE_CONFIG.flagshipSellerId,
          title,
          slug,
          description,
          categoryId,
          brandId: brandId || null,
          featured: Boolean(featured),
          weightGrams: Number(weightGrams),
          status: ProductStatus.PUBLISHED,
          isApprovedByPlatform: true,
        },
      });

      if (imageUrl) {
        await tx.productMedia.create({
          data: {
            productId: p.id,
            url: imageUrl,
            altText: title,
            isThumbnail: true,
            displayOrder: 0,
          },
        });
      }

      const variant = await tx.productVariant.create({
        data: {
          productId: p.id,
          sku: initialSku,
          title: variantTitle,
          priceMinor: Number(priceMinor),
          compareAtPriceMinor: compareAtPriceMinor ? Number(compareAtPriceMinor) : null,
          attributesJson: JSON.stringify({ edition: variantTitle }),
        },
      });

      await tx.inventoryLevel.create({
        data: {
          variantId: variant.id,
          sellerOrgId: SITE_CONFIG.flagshipSellerId,
          availableUnits: Number(initialStock),
          reservedUnits: 0,
        },
      });

      await tx.inventoryAdjustment.create({
        data: {
          variantId: variant.id,
          sellerOrgId: SITE_CONFIG.flagshipSellerId,
          actorUserId: admin.id,
          deltaUnits: Number(initialStock),
          balanceAfter: Number(initialStock),
          reasonCode: InventoryAdjustmentReason.RECEIVING,
          notes: "Initial inventory receiving on product creation.",
        },
      });

      await tx.auditEvent.create({
        data: {
          actorUserId: admin.id,
          entityType: "Product",
          entityId: p.id,
          action: "CREATE_1P_PRODUCT",
          detailsJson: JSON.stringify({ title, sku: initialSku, stock: initialStock }),
        },
      });

      return p;
    });

    return NextResponse.json({ success: true, product });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error creating product";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
