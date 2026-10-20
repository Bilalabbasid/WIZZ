import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getSellerContextForUser } from "@/modules/sellers/services";
import { getSellerInventory, adjustSellerInventory } from "@/modules/sellers/catalog-services";
import { InventoryAdjustmentReason } from "@prisma/client";

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const context = await getSellerContextForUser(user.id);
    if (!context?.sellerOrg) {
      return NextResponse.json({ error: "No seller organization found for this user." }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const lowStockOnly = searchParams.get("lowStock") === "true";
    const query = searchParams.get("query") || undefined;
    const page = Number(searchParams.get("page")) || 1;
    const limit = Number(searchParams.get("limit")) || 25;

    const inventory = await getSellerInventory(context.sellerOrg.id, {
      lowStockOnly,
      query,
      page,
      limit,
    });

    return NextResponse.json({ success: true, ...inventory });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error fetching inventory";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

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

    const body = await req.json();
    const { variantId, deltaUnits, reasonCode, notes } = body;

    if (!variantId || deltaUnits === undefined || !reasonCode) {
      return NextResponse.json(
        { error: "variantId, deltaUnits, and reasonCode are required." },
        { status: 400 }
      );
    }

    const result = await adjustSellerInventory(
      context.sellerOrg.id,
      variantId,
      Number(deltaUnits),
      reasonCode as InventoryAdjustmentReason,
      notes,
      user.id
    );

    return NextResponse.json({ success: true, ...result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error adjusting inventory";
    const status = message.includes("FORBIDDEN") ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
