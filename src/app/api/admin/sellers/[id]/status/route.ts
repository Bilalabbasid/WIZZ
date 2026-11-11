import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { ADMIN_ACTION_ROLES } from "@/modules/admin/access";
import { changeSellerStatus, sellerStatusSchema } from "@/modules/admin/sellers";
import { adminErrorResponse, readJson, zodErrorResponse } from "@/modules/admin/http";

/**
 * POST /api/admin/sellers/[id]/status  { action: "suspend" | "reactivate", reason }
 * Roles: SUPER_ADMIN, CATALOG_ADMIN (support staff have read-only seller access).
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireRole(ADMIN_ACTION_ROLES.sellerStatus);
    const { id } = await params;
    const parsed = sellerStatusSchema.safeParse(await readJson(req));
    if (!parsed.success) return zodErrorResponse(parsed.error);

    const org = await changeSellerStatus(id, admin.id, parsed.data);
    revalidatePath("/");
    revalidatePath("/products");
    return NextResponse.json({
      success: true,
      seller: { id: org.id, operationalStatus: org.operationalStatus, suspensionReason: org.suspensionReason },
    });
  } catch (err) {
    return adminErrorResponse(err, "Could not change the seller's status.");
  }
}
