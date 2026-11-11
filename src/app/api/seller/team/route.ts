import { NextRequest, NextResponse } from "next/server";
import { SellerMembershipRole } from "@prisma/client";
import {
  getSellerTeamMembers,
  inviteSellerTeamMember,
  removeSellerTeamMember,
  revokeSellerInvitation,
} from "@/modules/sellers/services";
import { requireSellerContext, sellerErrorResponse, STORE_ADMIN_ROLES } from "@/modules/sellers/api-guard";

export const dynamic = "force-dynamic";

const appUrl = () => (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");

/** Team list with invite links (owners and admins only: links grant access). */
export async function GET() {
  try {
    const { context } = await requireSellerContext({ roles: STORE_ADMIN_ROLES, roleLabel: "manage the team" });
    const team = await getSellerTeamMembers(context.sellerOrg!.id);
    return NextResponse.json({
      success: true,
      members: team.members,
      invitations: team.invitations.map((inv) => ({
        id: inv.id,
        email: inv.email,
        role: inv.role,
        expiresAt: inv.expiresAt,
        invitedBy: inv.invitedBy,
        inviteUrl: `${appUrl()}/seller/invite/${inv.token}`,
      })),
    });
  } catch (err: unknown) {
    return sellerErrorResponse(err, "Could not load the team.");
  }
}

/** Creates an invitation and returns its link (sent by the owner; no email is sent automatically). */
export async function POST(req: NextRequest) {
  try {
    const { user, context, membership } = await requireSellerContext({ roles: STORE_ADMIN_ROLES, roleLabel: "invite team members" });
    const { email, role } = await req.json().catch(() => ({}));
    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Enter the email address to invite." }, { status: 400 });
    }

    const requestedRole = (role as SellerMembershipRole) || SellerMembershipRole.FULFILLMENT_MANAGER;
    // Only an owner can create another owner
    if (requestedRole === SellerMembershipRole.OWNER && membership.role !== SellerMembershipRole.OWNER) {
      return NextResponse.json({ error: "Only a store owner can invite another owner." }, { status: 403 });
    }

    const invitation = await inviteSellerTeamMember(context.sellerOrg!.id, user.id, email, requestedRole);
    return NextResponse.json({
      success: true,
      invitation: {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        expiresAt: invitation.expiresAt,
        inviteUrl: `${appUrl()}/seller/invite/${invitation.token}`,
      },
    });
  } catch (err: unknown) {
    return sellerErrorResponse(err, "Could not create the invitation.");
  }
}

/** Removes a member ({ membershipId }) or revokes a pending invitation ({ invitationId }). */
export async function DELETE(req: NextRequest) {
  try {
    const { user, context, membership } = await requireSellerContext({ roles: STORE_ADMIN_ROLES, roleLabel: "manage the team" });
    const { membershipId, invitationId } = await req.json().catch(() => ({}));

    if (invitationId) {
      await revokeSellerInvitation(context.sellerOrg!.id, invitationId);
      return NextResponse.json({ success: true });
    }
    if (!membershipId) {
      return NextResponse.json({ error: "Choose the member to remove." }, { status: 400 });
    }
    if (membershipId === membership.id) {
      return NextResponse.json({ error: "You cannot remove yourself." }, { status: 400 });
    }

    const effectiveRole = user.role === "PLATFORM_SUPER_ADMIN" ? "PLATFORM_SUPER_ADMIN" : membership.role;
    const updated = await removeSellerTeamMember(context.sellerOrg!.id, membershipId, effectiveRole);
    return NextResponse.json({ success: true, membership: { id: updated.id, isActive: updated.isActive } });
  } catch (err: unknown) {
    return sellerErrorResponse(err, "Could not update the team.");
  }
}
