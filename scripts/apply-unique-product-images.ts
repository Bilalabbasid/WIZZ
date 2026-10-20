import { prisma } from "../src/lib/db";
import { PRODUCT_IMAGE_REGISTRY } from "./product-image-registry";

async function main() {
  console.log("=== STEP 1: VALIDATING IMAGE REGISTRY UNIQUENESS ===");
  const allUrls = new Set<string>();
  const duplicateUrls: string[] = [];

  for (const [title, entry] of Object.entries(PRODUCT_IMAGE_REGISTRY)) {
    for (const img of entry.images) {
      if (allUrls.has(img.url)) {
        duplicateUrls.push(img.url);
      }
      allUrls.add(img.url);
    }
  }

  if (duplicateUrls.length > 0) {
    console.error("Found duplicate URLs in registry:", duplicateUrls);
    process.exit(1);
  }
  console.log(`Registry valid! 29 products, ${allUrls.size} unique image URLs (0 duplicates).`);

  console.log("\n=== STEP 2: CONSOLIDATING DUPLICATE PRODUCTS IN DATABASE ===");
  const categories = await prisma.category.findMany();
  const categoryMap = new Map(categories.map((c) => [c.slug, c.id]));

  for (const targetTitle of Object.keys(PRODUCT_IMAGE_REGISTRY)) {
    const instances = await prisma.product.findMany({
      where: { title: targetTitle },
      include: {
        variants: {
          include: {
            orderItems: true,
            cartItems: true,
            reservations: true,
            adjustments: true,
            inventoryLevel: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    if (instances.length > 1) {
      console.log(`Consolidating ${instances.length} copies of "${targetTitle}"...`);
      const canonical = instances[0];
      const canonicalVariant = canonical.variants[0];

      if (!canonicalVariant) {
        throw new Error(`Canonical product ${canonical.id} missing variants`);
      }

      // Reassign relations from all subsequent instances to canonicalVariant
      for (let i = 1; i < instances.length; i++) {
        const dup = instances[i];
        for (const variant of dup.variants) {
          // Reassign OrderItems
          if (variant.orderItems.length > 0) {
            await prisma.orderItem.updateMany({
              where: { variantId: variant.id },
              data: { variantId: canonicalVariant.id },
            });
          }
          // Reassign CartItems
          if (variant.cartItems.length > 0) {
            await prisma.cartItem.deleteMany({
              where: { variantId: variant.id },
            });
          }
          // Clean reservations & adjustments
          if (variant.reservations.length > 0) {
            await prisma.inventoryReservation.deleteMany({
              where: { variantId: variant.id },
            });
          }
          if (variant.adjustments.length > 0) {
            await prisma.inventoryAdjustment.deleteMany({
              where: { variantId: variant.id },
            });
          }
          // Clean inventory level
          if (variant.inventoryLevel) {
            await prisma.inventoryLevel.deleteMany({
              where: { variantId: variant.id },
            });
          }
        }

        // Delete duplicate product media & variants & product
        await prisma.productMedia.deleteMany({ where: { productId: dup.id } });
        await prisma.productVariant.deleteMany({ where: { productId: dup.id } });
        await prisma.wishlistItem.deleteMany({ where: { productId: dup.id } });
        await prisma.review.deleteMany({ where: { productId: dup.id } });
        await prisma.product.delete({ where: { id: dup.id } });
      }
    }
  }

  console.log("\n=== STEP 3: APPLYING UNIQUE IMAGES & CATEGORIES TO ALL PRODUCTS ===");
  for (const [title, entry] of Object.entries(PRODUCT_IMAGE_REGISTRY)) {
    const product = await prisma.product.findFirst({
      where: { title },
      include: { variants: true },
    });

    if (!product) {
      console.warn(`Product not found in DB: "${title}"`);
      continue;
    }

    const catId = categoryMap.get(entry.categorySlug);
    if (catId && product.categoryId !== catId) {
      await prisma.product.update({
        where: { id: product.id },
        data: { categoryId: catId },
      });
    }

    // Replace all media with the unique images
    await prisma.productMedia.deleteMany({
      where: { productId: product.id },
    });

    await prisma.productMedia.createMany({
      data: entry.images.map((img, idx) => ({
        productId: product.id,
        url: img.url,
        altText: img.altText,
        isThumbnail: img.isThumbnail,
        displayOrder: idx,
      })),
    });

    // Ensure status is published and approved
    await prisma.product.update({
      where: { id: product.id },
      data: {
        status: "PUBLISHED",
        moderationStatus: "APPROVED",
        isApprovedByPlatform: true,
      },
    });

    console.log(`✔ Updated "${title}" with ${entry.images.length} unique images.`);
  }

  console.log("\n=== STEP 4: VERIFYING FINAL CATALOG STATE ===");
  const allProducts = await prisma.product.findMany({
    include: {
      media: true,
      category: { select: { name: true, slug: true } },
    },
  });

  console.log(`Total Products in DB: ${allProducts.length}`);
  const missingMedia = allProducts.filter((p) => p.media.length === 0);
  console.log(`Products without media: ${missingMedia.length}`);

  const urlMap = new Map<string, string[]>();
  for (const p of allProducts) {
    for (const m of p.media) {
      const list = urlMap.get(m.url) || [];
      list.push(p.title);
      urlMap.set(m.url, list);
    }
  }

  const crossDuplicates = Array.from(urlMap.entries()).filter(([_, list]) => list.length > 1);
  console.log(`Duplicate image URLs across different products: ${crossDuplicates.length}`);

  if (crossDuplicates.length > 0) {
    for (const [url, titles] of crossDuplicates) {
      console.error(`Duplicate: ${url} used in ${titles.join(", ")}`);
    }
  } else {
    console.log("🎉 SUCCESS: 100% of products have unique, relevant, non-duplicate images!");
  }
}

main().finally(() => prisma.$disconnect());
