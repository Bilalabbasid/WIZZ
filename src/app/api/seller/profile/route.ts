import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getSellerContextForUser, updateSellerOrgProfile } from "@/modules/sellers/services";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const context = await getSellerContextForUser(user.id);
    if (!context?.sellerOrg) {
      return NextResponse.json({ error: "No seller organization found for this user." }, { status: 404 });
    }

    const org = await prisma.sellerOrg.findUnique({
      where: { id: context.sellerOrg.id },
    });

    return NextResponse.json({ success: true, profile: org });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error fetching profile";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PUT(req: NextRequest) {
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
    const updated = await updateSellerOrgProfile(context.sellerOrg.id, body, user.id);

    return NextResponse.json({ success: true, profile: updated });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error updating profile";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
