import { prisma } from "../src/lib/db";

async function main() {
  const targets = await prisma.product.findMany({
    where: {
      OR: [
        { title: { startsWith: "Last Unit Race" } },
        { title: { startsWith: "HACKED OR" } },
        { title: { startsWith: "Alpha Commerce Item" } },
        { title: { startsWith: "Beta Commerce Item" } },
        { title: { startsWith: "Indus Bushcraft Hunting Knife" } },
        { title: { startsWith: "Seller A Precision Hardware" } },
        { title: { startsWith: "WIZZ 1P Precision Tool v" } },
      ],
    },
    include: { variants: true },
  });

  console.log(`Found ${targets.length} leftover test products to remove.`);

  for (const p of targets) {
    try {
      // Check if product has order items
      const hasOrders = await prisma.orderItem.findFirst({
        where: { variant: { productId: p.id } },
      });
      if (hasOrders) {
        await prisma.product.update({
          where: { id: p.id },
          data: { status: "ARCHIVED", isApprovedByPlatform: false },
        });
        console.log(`Archived test product with orders: "${p.title}" (${p.id})`);
        continue;
      }

      for (const v of p.variants) {
        await prisma.inventoryReservation.deleteMany({ where: { variantId: v.id } });
        await prisma.inventoryAdjustment.deleteMany({ where: { variantId: v.id } });
        await prisma.inventoryLevel.deleteMany({ where: { variantId: v.id } });
        await prisma.cartItem.deleteMany({ where: { variantId: v.id } });
        await prisma.orderItem.deleteMany({ where: { variantId: v.id } });
      }
      await prisma.productVariant.deleteMany({ where: { productId: p.id } });
      await prisma.productMedia.deleteMany({ where: { productId: p.id } });
      await prisma.wishlistItem.deleteMany({ where: { productId: p.id } });
      await prisma.review.deleteMany({ where: { productId: p.id } });
      await prisma.product.delete({ where: { id: p.id } });
      console.log(`Deleted test product: "${p.title}" (${p.id})`);
    } catch (err) {
      await prisma.product.update({
        where: { id: p.id },
        data: { status: "ARCHIVED", isApprovedByPlatform: false },
      });
      console.log(`Fallback archived test product: "${p.title}" (${p.id})`);
    }
  }
}

main().finally(() => prisma.$disconnect());
