import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { UserRole } from "@prisma/client";
import { suspendSellerOrg, reactivateSellerOrg } from "@/modules/sellers/services";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireRole([
      UserRole.PLATFORM_SUPER_ADMIN,
      UserRole.PLATFORM_SUPPORT,
    ]);

    const { id } = await params;
    const { action, reason } = await req.json();

    if (action === "SUSPEND") {
      if (!reason || reason.trim().length === 0) {
        return NextResponse.json({ error: "A suspension reason is required." }, { status: 400 });
      }
      const org = await suspendSellerOrg(id, admin.id, reason.trim());
      return NextResponse.json({ success: true, org });
    } else if (action === "REACTIVATE") {
      const org = await reactivateSellerOrg(id, admin.id);
      return NextResponse.json({ success: true, org });
    } else {
      return NextResponse.json({ error: "Invalid action. Must be SUSPEND or REACTIVATE." }, { status: 400 });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error modifying seller organization";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
