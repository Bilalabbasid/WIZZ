import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { ADMIN_SECTION_ROLES } from "@/modules/admin/access";
import { getCustomerDetail } from "@/modules/admin/customers";
import { adminErrorResponse } from "@/modules/admin/http";

export const dynamic = "force-dynamic";

/** GET /api/admin/customers/[id] — profile, addresses and recent orders (no credentials). */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole(ADMIN_SECTION_ROLES.customers);
    const { id } = await params;
    const customer = await getCustomerDetail(id);
    if (!customer) {
      return NextResponse.json({ error: "Customer not found." }, { status: 404 });
    }
    return NextResponse.json({ customer }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (err) {
    return adminErrorResponse(err, "Could not load customer.");
  }
}
