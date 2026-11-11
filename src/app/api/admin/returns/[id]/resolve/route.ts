import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { clientErrorMessage, clientErrorStatus } from "@/lib/api-error";
import { requireRole } from "@/lib/auth";
import { UserRole } from "@prisma/client";
import { transitionReturnRequest } from "@/modules/returns/services";

const bodySchema = z.object({
  action: z.enum(["APPROVE", "REJECT", "MARK_RECEIVED", "RECORD_REFUND"]),
  note: z.string().trim().max(1000).optional(),
  refundReference: z.string().trim().max(120).optional(),
});

const REVIEW_ROLES: UserRole[] = [UserRole.PLATFORM_SUPER_ADMIN, UserRole.PLATFORM_SUPPORT];
const FINANCE_ROLES: UserRole[] = [UserRole.PLATFORM_SUPER_ADMIN, UserRole.PLATFORM_FINANCE_ADMIN];

/**
 * Admin moves a return along SUBMITTED -> APPROVED/REJECTED -> RECEIVED -> REFUNDED.
 * RECORD_REFUND is a finance action and needs the reference of the refund actually paid.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: "Choose an action: APPROVE, REJECT, MARK_RECEIVED or RECORD_REFUND." }, { status: 400 });
    }
    const { action, note, refundReference } = parsed.data;
    const user = await requireRole(action === "RECORD_REFUND" ? FINANCE_ROLES : REVIEW_ROLES);
    const { id } = await params;

    const returnRequest = await transitionReturnRequest(id, action, { actorUserId: user.id, note, refundReference });
    return NextResponse.json({ success: true, returnRequest });
  } catch (err: unknown) {
    const status = clientErrorStatus(err);
    return NextResponse.json(
      { error: clientErrorMessage(err, "Could not update the return.") },
      { status: /already|someone else|cannot be/.test(String((err as Error)?.message)) && status === 400 ? 409 : status }
    );
  }
}
