import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { UserRole, InventoryAdjustmentReason } from "@prisma/client";
import { adjustInventoryStock } from "@/modules/inventory/services";

export async function POST(req: NextRequest) {
  try {
    const admin = await requireRole([
      UserRole.PLATFORM_SUPER_ADMIN,
      UserRole.PLATFORM_CATALOG_ADMIN,
    ]);

    const { variantId, sellerOrgId, deltaUnits, reasonCode, notes } = await req.json();

    if (!variantId || !sellerOrgId || deltaUnits === undefined || !reasonCode) {
      return NextResponse.json(
        { error: "variantId, sellerOrgId, deltaUnits, and reasonCode are required." },
        { status: 400 }
      );
    }

    const result = await adjustInventoryStock(
      variantId,
      sellerOrgId,
      admin.id,
      Number(deltaUnits),
      reasonCode as InventoryAdjustmentReason,
      notes
    );

    return NextResponse.json({ success: true, result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error adjusting inventory";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
