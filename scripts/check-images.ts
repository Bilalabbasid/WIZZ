import { prisma } from "../src/lib/db";

async function main() {
  const noMedia = await prisma.product.findMany({
    where: { media: { none: {} } },
    select: {
      id: true,
      title: true,
      slug: true,
      status: true,
      category: { select: { name: true, slug: true } },
    },
  });

  console.log(`Products without media: ${noMedia.length}`);
  const uniqueTitles = new Map<string, number>();
  for (const p of noMedia) {
    const key = `${p.title} (${p.category?.name || "No Category"}) [${p.status}]`;
    uniqueTitles.set(key, (uniqueTitles.get(key) || 0) + 1);
  }

  for (const [title, count] of uniqueTitles.entries()) {
    console.log(`- ${title} : x${count}`);
  }
}

main().finally(() => prisma.$disconnect());
