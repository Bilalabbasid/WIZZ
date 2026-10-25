import { NextRequest, NextResponse } from "next/server";
import { ProductModerationStatus, ProductStatus } from "@prisma/client";
import {
  getSellerProducts,
  getSellerProductCounts,
  createSellerProduct,
  isSellerProductView,
} from "@/modules/sellers/catalog-services";
import { requireSellerContext, sellerErrorResponse } from "@/modules/sellers/api-guard";

export const dynamic = "force-dynamic";

function enumParam<T extends Record<string, string>>(values: T, raw: string | null): T[keyof T] | undefined {
  return raw && (Object.values(values) as string[]).includes(raw) ? (raw as T[keyof T]) : undefined;
}

export async function GET(req: NextRequest) {
  try {
    const { sellerOrg } = await requireSellerContext();
    const { searchParams } = new URL(req.url);

    const view = searchParams.get("view");

    const [result, counts] = await Promise.all([
      getSellerProducts(sellerOrg.id, {
        query: searchParams.get("query") || undefined,
        status: enumParam(ProductStatus, searchParams.get("status")),
        moderationStatus: enumParam(ProductModerationStatus, searchParams.get("moderation")),
        categoryId: searchParams.get("categoryId") || undefined,
        view: isSellerProductView(view) ? view : undefined,
        page: Number(searchParams.get("page")) || 1,
        limit: Number(searchParams.get("limit")) || 20,
      }),
      getSellerProductCounts(sellerOrg.id),
    ]);

    return NextResponse.json({ success: true, ...result, counts });
  } catch (err: unknown) {
    return sellerErrorResponse(err, "Error fetching products");
  }
}

export async function POST(req: NextRequest) {
  try {
    const { user, sellerOrg } = await requireSellerContext({ catalogWrite: true });
    const body = await req.json();
    const product = await createSellerProduct(sellerOrg.id, body, user.id);
    return NextResponse.json({ success: true, product });
  } catch (err: unknown) {
    return sellerErrorResponse(err, "Error creating product");
  }
}
