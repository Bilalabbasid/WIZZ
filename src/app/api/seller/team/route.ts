import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  getSellerContextForUser,
  getSellerTeamMembers,
  inviteSellerTeamMember,
  removeSellerTeamMember,
} from "@/modules/sellers/services";
import { SellerMembershipRole } from "@prisma/client";

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

    const team = await getSellerTeamMembers(context.sellerOrg.id);

    return NextResponse.json({ success: true, ...team });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error fetching team";
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

    const isSuperAdmin = user.role === "PLATFORM_SUPER_ADMIN";
    const callerRole = context.membership?.role;

    // Only OWNER or ADMIN can invite team members
    if (!isSuperAdmin && callerRole !== SellerMembershipRole.OWNER && callerRole !== SellerMembershipRole.ADMIN) {
      return NextResponse.json(
        { error: "FORBIDDEN: Only organization Owners and Admins can invite team members." },
        { status: 403 }
      );
    }

    const { email, role } = await req.json();
    if (!email) {
      return NextResponse.json({ error: "Email is required." }, { status: 400 });
    }

    const requestedRole = (role as SellerMembershipRole) || SellerMembershipRole.ADMIN;

    // Privilege escalation protection: only an existing OWNER can invite another OWNER
    if (requestedRole === SellerMembershipRole.OWNER && !isSuperAdmin && callerRole !== SellerMembershipRole.OWNER) {
      return NextResponse.json(
        { error: "FORBIDDEN: Only an organization Owner can invite another Owner." },
        { status: 403 }
      );
    }

    const invitation = await inviteSellerTeamMember(
      context.sellerOrg.id,
      user.id,
      email,
      requestedRole
    );

    return NextResponse.json({ success: true, invitation });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error inviting team member";
    const status = message.includes("FORBIDDEN") ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const context = await getSellerContextForUser(user.id);
    if (!context?.sellerOrg) {
      return NextResponse.json({ error: "No seller organization found for this user." }, { status: 404 });
    }

    const isSuperAdmin = user.role === "PLATFORM_SUPER_ADMIN";
    const callerRole = context.membership?.role;

    // Only OWNER or ADMIN can remove team members
    if (!isSuperAdmin && callerRole !== SellerMembershipRole.OWNER && callerRole !== SellerMembershipRole.ADMIN) {
      return NextResponse.json(
        { error: "FORBIDDEN: Only organization Owners and Admins can remove team members." },
        { status: 403 }
      );
    }

    const { membershipId } = await req.json();
    if (!membershipId) {
      return NextResponse.json({ error: "membershipId is required." }, { status: 400 });
    }

    const effectiveRole = isSuperAdmin ? "PLATFORM_SUPER_ADMIN" : callerRole;
    const updated = await removeSellerTeamMember(context.sellerOrg.id, membershipId, effectiveRole);

    return NextResponse.json({ success: true, membership: updated });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error removing team member";
    const status = message.includes("FORBIDDEN") ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
