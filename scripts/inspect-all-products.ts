import { prisma } from "../src/lib/db";

async function main() {
  const products = await prisma.product.findMany({
    include: {
      category: { select: { name: true } },
      sellerOrg: { select: { name: true } },
      media: true,
      variants: {
        include: {
          _count: {
            select: {
              orderItems: true,
              cartItems: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  console.log(`Total products: ${products.length}`);

  const byTitle = new Map<string, typeof products>();
  for (const p of products) {
    const list = byTitle.get(p.title) || [];
    list.push(p);
    byTitle.set(p.title, list);
  }

  console.log(`Unique titles count: ${byTitle.size}`);

  for (const [title, prods] of byTitle.entries()) {
    const totalOrders = prods.reduce(
      (acc, p) => acc + p.variants.reduce((vAcc, v) => vAcc + v._count.orderItems, 0),
      0
    );
    const totalCarts = prods.reduce(
      (acc, p) => acc + p.variants.reduce((vAcc, v) => vAcc + v._count.cartItems, 0),
      0
    );
    console.log(
      `- "${title}": ${prods.length} instance(s) | Category: ${prods[0].category.name} | Orders: ${totalOrders} | Carts: ${totalCarts}`
    );
  }
}

main().finally(() => prisma.$disconnect());
