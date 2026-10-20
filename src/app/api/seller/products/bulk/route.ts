import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getSellerContextForUser } from "@/modules/sellers/services";
import { bulkUpdateSellerVariants } from "@/modules/sellers/catalog-services";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const context = await getSellerContextForUser(user.id);
    if (!context?.sellerOrg) {
      return NextResponse.json({ error: "No seller organization found for this user." }, { status: 404 });
    }

    const { updates } = await req.json();
    if (!updates || !Array.isArray(updates) || updates.length === 0) {
      return NextResponse.json({ error: "An array of variant updates is required." }, { status: 400 });
    }

    const results = await bulkUpdateSellerVariants(context.sellerOrg.id, updates, user.id);

    return NextResponse.json({
      success: true,
      updatedCount: results.length,
      results,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error performing bulk updates";
    const status = message.includes("FORBIDDEN") ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
