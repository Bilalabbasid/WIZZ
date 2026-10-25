import { NextRequest, NextResponse } from "next/server";
import { getSellerInventory, adjustSellerInventory } from "@/modules/sellers/catalog-services";
import { requireSellerContext, sellerErrorResponse } from "@/modules/sellers/api-guard";
import { InventoryAdjustmentReason } from "@prisma/client";

export async function GET(req: NextRequest) {
  try {
    const { sellerOrg } = await requireSellerContext();

    const { searchParams } = new URL(req.url);
    const inventory = await getSellerInventory(sellerOrg.id, {
      lowStockOnly: searchParams.get("lowStock") === "true",
      query: searchParams.get("query") || undefined,
      page: Number(searchParams.get("page")) || 1,
      limit: Number(searchParams.get("limit")) || 25,
    });

    return NextResponse.json({ success: true, ...inventory });
  } catch (err: unknown) {
    return sellerErrorResponse(err, "Error fetching inventory");
  }
}

export async function POST(req: NextRequest) {
  try {
    const { user, sellerOrg } = await requireSellerContext({ catalogWrite: true });

    const { variantId, deltaUnits, reasonCode, notes } = await req.json();

    if (!variantId || typeof variantId !== "string" || deltaUnits === undefined || !reasonCode) {
      return NextResponse.json(
        { error: "variantId, deltaUnits, and reasonCode are required." },
        { status: 400 }
      );
    }
    const delta = Number(deltaUnits);
    if (!Number.isInteger(delta) || delta === 0 || Math.abs(delta) > 1_000_000) {
      return NextResponse.json({ error: "Adjustment must be a non-zero whole number of units." }, { status: 400 });
    }
    if (!(Object.values(InventoryAdjustmentReason) as string[]).includes(reasonCode)) {
      return NextResponse.json({ error: "Choose a valid adjustment reason." }, { status: 400 });
    }

    const result = await adjustSellerInventory(
      sellerOrg.id,
      variantId,
      delta,
      reasonCode as InventoryAdjustmentReason,
      typeof notes === "string" ? notes.slice(0, 500) : undefined,
      user.id
    );

    return NextResponse.json({ success: true, ...result });
  } catch (err: unknown) {
    return sellerErrorResponse(err, "Error adjusting inventory");
  }
}
