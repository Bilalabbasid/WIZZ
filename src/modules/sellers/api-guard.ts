import { NextResponse } from "next/server";
import { SellerMembershipRole } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { getSellerContextForUser } from "./services";

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
export async function requireSellerContext(options: { catalogWrite?: boolean } = {}) {
  const user = await getCurrentUser();
  if (!user) throw new SellerApiError("Unauthorized", 401);

  const context = await getSellerContextForUser(user.id);
  if (!context?.sellerOrg || !context.membership) {
    throw new SellerApiError("No seller organization found for this user.", 404);
  }

  if (options.catalogWrite && !CATALOG_WRITE_ROLES.includes(context.membership.role)) {
    throw new SellerApiError(
      "FORBIDDEN: Your team role cannot change products, prices or stock. Ask your store owner for catalog access.",
      403
    );
  }

  return { user, context, sellerOrg: context.sellerOrg, membership: context.membership };
}

/** Maps thrown errors to JSON responses consistently across seller routes. */
export function sellerErrorResponse(err: unknown, fallback: string) {
  if (err instanceof SellerApiError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  const message = err instanceof Error ? err.message : fallback;
  const status = message.includes("FORBIDDEN") ? 403 : 400;
  return NextResponse.json({ error: message }, { status });
}
