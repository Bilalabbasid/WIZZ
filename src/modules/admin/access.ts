import { notFound, redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";

const SUPER = UserRole.PLATFORM_SUPER_ADMIN;
const CATALOG = UserRole.PLATFORM_CATALOG_ADMIN;
const FINANCE = UserRole.PLATFORM_FINANCE_ADMIN;
const SUPPORT = UserRole.PLATFORM_SUPPORT;

export const ALL_ADMIN_ROLES: UserRole[] = [SUPER, CATALOG, FINANCE, SUPPORT];

/**
 * Single source of truth for which platform roles may open each admin section.
 * Pages call `requireAdminPage(ADMIN_SECTION_ROLES.x, path)` and the matching API routes
 * call `requireRole(...)` with the same (or a stricter, mutation-specific) list.
 * Navigation visibility is derived from this map but is NOT the authorization boundary.
 */
export const ADMIN_SECTION_ROLES = {
  dashboard: ALL_ADMIN_ROLES,
  applications: [SUPER, CATALOG, SUPPORT],
  // Finance needs seller pages for payouts; status/commission actions stay restricted below.
  sellers: [SUPER, CATALOG, SUPPORT, FINANCE],
  products: [SUPER, CATALOG],
  categories: [SUPER, CATALOG],
  reviews: [SUPER, CATALOG],
  inventory: [SUPER, CATALOG],
  orders: [SUPER, SUPPORT, FINANCE],
  returns: [SUPER, SUPPORT, FINANCE],
  customers: [SUPER, SUPPORT],
  coupons: [SUPER, FINANCE],
  refunds: [SUPER, FINANCE],
  settings: [SUPER],
  auditLogs: [SUPER],
} satisfies Record<string, UserRole[]>;

export type AdminSection = keyof typeof ADMIN_SECTION_ROLES;

/** Mutation-level role lists that are stricter than the section's read list. */
export const ADMIN_ACTION_ROLES = {
  sellerStatus: [SUPER, CATALOG] as UserRole[],
  sellerCommission: [SUPER] as UserRole[],
  returnReview: [SUPER, SUPPORT] as UserRole[],
  returnRefund: [SUPER, FINANCE] as UserRole[],
  orderFulfil: [SUPER, SUPPORT] as UserRole[],
  codReconcile: [SUPER, FINANCE] as UserRole[],
  applicationReview: [SUPER, SUPPORT] as UserRole[],
  sellerPayouts: [SUPER, FINANCE] as UserRole[],
};

export function canAccessSection(role: UserRole, section: AdminSection): boolean {
  return (ADMIN_SECTION_ROLES[section] as UserRole[]).includes(role);
}

export function hasAnyRole(role: UserRole, roles: UserRole[]): boolean {
  return roles.includes(role);
}

/**
 * Page-level guard for every admin page. Layouts do not re-render on client navigation,
 * so each page must enforce its own role list.
 *
 * - Not signed in → /login?next=<path>
 * - Customer (non-platform) account → 404 (the admin console is not advertised to customers)
 * - Platform staff without this section's role → back to the dashboard with a notice
 */
export async function requireAdminPage(section: AdminSection, nextPath: string) {
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  }
  if (!ALL_ADMIN_ROLES.includes(user.role)) {
    notFound();
  }
  if (!canAccessSection(user.role, section)) {
    redirect(`/admin?denied=${encodeURIComponent(section)}`);
  }
  return user;
}

export function formatRole(role: UserRole): string {
  return role.replace("PLATFORM_", "").replace(/_/g, " ");
}
