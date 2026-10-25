import { NextRequest, NextResponse } from "next/server";
import { bulkUpdateSellerVariants } from "@/modules/sellers/catalog-services";
import { requireSellerContext, sellerErrorResponse } from "@/modules/sellers/api-guard";

export async function POST(req: NextRequest) {
  try {
    const { user, sellerOrg } = await requireSellerContext({ catalogWrite: true });

    const { updates } = await req.json();
    if (!updates || !Array.isArray(updates) || updates.length === 0) {
      return NextResponse.json({ error: "An array of variant updates is required." }, { status: 400 });
    }

    const results = await bulkUpdateSellerVariants(sellerOrg.id, updates, user.id);

    return NextResponse.json({
      success: true,
      updatedCount: results.length,
      results,
    });
  } catch (err: unknown) {
    return sellerErrorResponse(err, "Error performing bulk updates");
  }
}
