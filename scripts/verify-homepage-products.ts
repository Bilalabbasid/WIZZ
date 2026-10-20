import { getFeaturedProducts, getProducts } from "../src/modules/catalog/services";
import { prisma } from "../src/lib/db";
import { ProductStatus } from "@prisma/client";

async function main() {
  const [featured, newArrivals, flashSales] = await Promise.all([
    getFeaturedProducts(10),
    getProducts({ sort: "newest", limit: 6 }),
    prisma.product.findMany({
      where: {
        status: ProductStatus.PUBLISHED,
        isApprovedByPlatform: true,
        sellerOrg: { operationalStatus: "ACTIVE" },
        variants: {
          some: {
            isActive: true,
            compareAtPriceMinor: { not: null },
          },
        },
      },
      take: 6,
      orderBy: { createdAt: "desc" },
      include: {
        media: true,
      },
    }),
  ]);

  console.log("=== FLASH SALES (Row 1 on Home) ===");
  for (const p of flashSales) {
    console.log(`- "${p.title}" | img: ${p.media[0]?.url ? p.media[0].url.substring(0, 50) + '...' : 'NONE'}`);
  }

  console.log("\n=== FEATURED PRODUCTS (Row 2 on Home) ===");
  for (const p of featured) {
    console.log(`- "${p.title}" | img: ${p.media[0]?.url ? p.media[0].url.substring(0, 50) + '...' : 'NONE'}`);
  }

  console.log("\n=== NEW ARRIVALS (Row 3 on Home) ===");
  for (const p of newArrivals.products) {
    console.log(`- "${p.title}" | img: ${p.media[0]?.url ? p.media[0].url.substring(0, 50) + '...' : 'NONE'}`);
  }
}

main().finally(() => prisma.$disconnect());
