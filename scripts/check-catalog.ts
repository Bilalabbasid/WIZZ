import { prisma } from "../src/lib/db";

async function main() {
  const all = await prisma.product.findMany({
    include: {
      media: true,
      category: { select: { name: true } },
    },
  });
  console.log(`Total products: ${all.length}`);
  const withoutMedia = all.filter((p) => p.media.length === 0);
  console.log(`Without media: ${withoutMedia.length}`);
  for (const p of withoutMedia) {
    console.log(`  [NO MEDIA] ${p.id} | ${p.title} (${p.status})`);
  }

  const urlUsage = new Map<string, string[]>();
  for (const p of all) {
    for (const m of p.media) {
      const list = urlUsage.get(m.url) || [];
      list.push(p.title);
      urlUsage.set(m.url, list);
    }
  }

  const duplicates = Array.from(urlUsage.entries()).filter(([_, titles]) => {
    const uniqueTitles = new Set(titles);
    return uniqueTitles.size > 1;
  });

  console.log(`Duplicate image URLs shared across distinct products: ${duplicates.length}`);
  for (const [url, titles] of duplicates) {
    console.log(`  Duplicate url: ${url.slice(0, 50)}...`);
    console.log(`    used by: ${titles.join(", ")}`);
  }
}

main().finally(() => prisma.$disconnect());



