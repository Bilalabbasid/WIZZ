import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  getSellerContextForUser,
  getSellerNotifications,
  markNotificationRead,
} from "@/modules/sellers/services";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const context = await getSellerContextForUser(user.id);
    const notifications = await getSellerNotifications(user.id, context?.sellerOrg?.id);

    return NextResponse.json({ success: true, notifications });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error fetching notifications";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { notificationId } = await req.json();
    if (!notificationId) {
      return NextResponse.json({ error: "notificationId is required." }, { status: 400 });
    }

    await markNotificationRead(notificationId, user.id);

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error marking notification as read";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
