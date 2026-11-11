import { NextRequest, NextResponse } from "next/server";
import { clientErrorMessage, clientErrorStatus } from "@/lib/api-error";
import { prisma } from "@/lib/db";
import { publicProductWhere } from "@/modules/catalog/services";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim().slice(0, 100);

    if (!q || q.length < 2) {
      // Return top categories and popular suggestions
      const categories = await prisma.category.findMany({
        where: { isActive: true },
        take: 5,
        orderBy: { displayOrder: "asc" },
        select: { id: true, name: true, slug: true },
      });
      return NextResponse.json({
        categories,
        products: [],
      });
    }

    const [matchedCategories, matchedProducts] = await Promise.all([
      // 1. Categories matching name
      prisma.category.findMany({
        where: {
          isActive: true,
          name: { contains: q, mode: "insensitive" },
        },
        take: 3,
        select: { id: true, name: true, slug: true },
      }),

      // 2. Products matching title, description, or brand
      prisma.product.findMany({
        where: {
          // Same public-visibility rule as listings and the product page
          ...publicProductWhere,
          variants: { some: { isActive: true } },
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { brand: { name: { contains: q, mode: "insensitive" } } },
            { category: { name: { contains: q, mode: "insensitive" } } },
          ],
        },
        take: 6,
        select: {
          id: true,
          title: true,
          slug: true,
          category: { select: { name: true, slug: true } },
          brand: { select: { name: true } },
          media: {
            take: 1,
            select: { url: true, altText: true },
            orderBy: { displayOrder: "asc" },
          },
          variants: {
            where: { isActive: true },
            take: 1,
            select: { priceMinor: true, compareAtPriceMinor: true },
            orderBy: { priceMinor: "asc" },
          },
        },
      }),
    ]);

    const formattedProducts = matchedProducts.map((p) => ({
      id: p.id,
      title: p.title,
      slug: p.slug,
      categoryName: p.category?.name || "General",
      brandName: p.brand?.name || null,
      thumbnail: p.media[0]?.url || null,
      priceMinor: p.variants[0]?.priceMinor || 0,
      compareAtPriceMinor: p.variants[0]?.compareAtPriceMinor || null,
    }));

    return NextResponse.json({
      categories: matchedCategories,
      products: formattedProducts,
    });
  } catch (err: unknown) {
    const message = clientErrorMessage(err, "Search suggestions are unavailable right now.");
    return NextResponse.json({ error: message }, { status: clientErrorStatus(err, 500) });
  }
}
