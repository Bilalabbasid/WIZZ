import { NextRequest, NextResponse } from "next/server";
import { clientErrorMessage } from "@/lib/api-error";
import { getCurrentUser } from "@/lib/auth";
import { getSellerContextForUser, getSellerNotifications, markNotificationRead } from "@/modules/sellers/services";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
    const context = await getSellerContextForUser(user.id);
    const notifications = await getSellerNotifications(user.id, context?.sellerOrg?.id);
    return NextResponse.json({ success: true, notifications });
  } catch (err: unknown) {
    return NextResponse.json({ error: clientErrorMessage(err, "Could not load notifications.") }, { status: 400 });
  }
}

/** Marks one ({ notificationId }) or all ({ all: true }) of the caller's notifications read. */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
    const { notificationId, all } = await req.json().catch(() => ({}));
    if (all === true) {
      await markNotificationRead(null, user.id);
      return NextResponse.json({ success: true });
    }
    if (!notificationId || typeof notificationId !== "string") {
      return NextResponse.json({ error: "Choose a notification." }, { status: 400 });
    }
    const res = await markNotificationRead(notificationId, user.id);
    if (res.count === 0) return NextResponse.json({ error: "Notification not found." }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: clientErrorMessage(err, "Could not update the notification.") }, { status: 400 });
  }
}
