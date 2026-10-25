import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { SITE_CONFIG } from "@/lib/config";
import { createSellerProduct } from "@/modules/sellers/catalog-services";

/**
 * Quick-create a first-party (WIZZ.PK Direct) listing from the admin console.
 * Delegates to the seller catalog service so the same validation applies.
 */
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

    const product = await createSellerProduct(
      SITE_CONFIG.flagshipSellerId,
      {
        title,
        description,
        categoryId,
        brandId: brandId || null,
        weightGrams: Number(weightGrams),
        submitForReview: Boolean(imageUrl),
        images: imageUrl ? [{ url: String(imageUrl), altText: title, isThumbnail: true }] : [],
        variants: [
          {
            title: variantTitle,
            sku: String(initialSku),
            priceMinor: Number(priceMinor),
            compareAtPriceMinor: compareAtPriceMinor ? Number(compareAtPriceMinor) : null,
            initialStock: Number(initialStock),
            attributes: { edition: variantTitle },
          },
        ],
      },
      admin.id
    );

    if (featured) {
      await prisma.product.update({ where: { id: product.id }, data: { featured: true } });
    }

    return NextResponse.json({ success: true, product });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error creating product";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
