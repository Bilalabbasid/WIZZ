import { NextResponse } from "next/server";
import { SellerMembershipRole } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { getSellerContextForUser } from "./services";
import { clientErrorMessage, clientErrorStatus } from "@/lib/api-error";
import { isSellerPortalActive } from "@/lib/flags";
import { isFirstPartySeller } from "@/lib/config";

/** Roles allowed to manage store settings, bank details, payouts and the team. */
export const STORE_ADMIN_ROLES: SellerMembershipRole[] = [SellerMembershipRole.OWNER, SellerMembershipRole.ADMIN];

/** Roles allowed to process orders, shipments and returns. */
export const FULFILLMENT_ROLES: SellerMembershipRole[] = [
  SellerMembershipRole.OWNER,
  SellerMembershipRole.ADMIN,
  SellerMembershipRole.FULFILLMENT_MANAGER,
];

/** Roles allowed to change listings, prices, deals, stock and product media. */
export const CATALOG_WRITE_ROLES: SellerMembershipRole[] = [
  SellerMembershipRole.OWNER,
  SellerMembershipRole.ADMIN,
  SellerMembershipRole.CATALOG_MANAGER,
];

export class SellerApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

/**
 * Resolves the caller's seller organization from their authenticated membership
 * (never from a client-supplied id). With `catalogWrite`, also requires a role
 * that may manage the catalog.
 */
export async function requireSellerContext(
  options: { catalogWrite?: boolean; roles?: SellerMembershipRole[]; roleLabel?: string } = {}
) {
  const user = await getCurrentUser();
  if (!user) throw new SellerApiError("Unauthorized", 401);

  const context = await getSellerContextForUser(user.id);
  if (!context?.sellerOrg || !context.membership) {
    throw new SellerApiError("No seller organization found for this user.", 404);
  }

  // Feature flag: external sellers are blocked while the seller portal is switched off;
  // the first-party store keeps working.
  if (!isSellerPortalActive() && !isFirstPartySeller(context.sellerOrg)) {
    throw new SellerApiError("The seller portal is not open yet.", 403);
  }

  // A suspended or closed store cannot change its catalog (it can still fulfil open orders)
  if (
    options.catalogWrite &&
    (context.sellerOrg.operationalStatus === "SUSPENDED" || context.sellerOrg.operationalStatus === "CLOSED")
  ) {
    throw new SellerApiError(
      "Your store is suspended, so listings, prices and stock can't be changed. Contact WIZZ.PK support.",
      403
    );
  }

  if (options.catalogWrite && !CATALOG_WRITE_ROLES.includes(context.membership.role)) {
    throw new SellerApiError(
      "FORBIDDEN: Your team role cannot change products, prices or stock. Ask your store owner for catalog access.",
      403
    );
  }

  if (options.roles && !options.roles.includes(context.membership.role)) {
    throw new SellerApiError(
      `FORBIDDEN: Your team role cannot ${options.roleLabel || "perform this action"}. Ask your store owner for access.`,
      403
    );
  }

  return { user, context, sellerOrg: context.sellerOrg, membership: context.membership };
}

/** Maps thrown errors to JSON responses consistently across seller routes. */
export function sellerErrorResponse(err: unknown, fallback: string) {
  if (err instanceof SellerApiError) {
    return NextResponse.json({ error: err.message.replace(/^FORBIDDEN:\s*/, "") }, { status: err.status });
  }
  return NextResponse.json({ error: clientErrorMessage(err, fallback) }, { status: clientErrorStatus(err) });
}
