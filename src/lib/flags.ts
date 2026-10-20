// Server-Enforced Feature Flags for WIZZ.PK Platform Rollout

export function isSellerPortalActive(): boolean {
  return process.env.FEATURE_SELLER_PORTAL_ACTIVE === "true";
}

export function isMarketplaceSettlementsActive(): boolean {
  return process.env.FEATURE_MARKETPLACE_SETTLEMENTS === "true";
}

export function isGuestCheckoutAllowed(): boolean {
  return process.env.FEATURE_GUEST_CHECKOUT !== "false";
}

export function isReviewsModerationActive(): boolean {
  return process.env.FEATURE_REVIEWS_MODERATION !== "false";
}

/**
 * Asserts that a stage feature is active on the server.
 * Throws a typed Forbidden error if access is blocked by feature flag.
 */
export function assertFeatureFlag(flag: "SELLER_PORTAL" | "MARKETPLACE_SETTLEMENTS") {
  if (flag === "SELLER_PORTAL" && !isSellerPortalActive()) {
    throw new Error("FEATURE_DISABLED: External seller portal management is currently inactive in Stage 1 rollout.");
  }
  if (flag === "MARKETPLACE_SETTLEMENTS" && !isMarketplaceSettlementsActive()) {
    throw new Error("FEATURE_DISABLED: Marketplace commission settlements are inactive in Stage 1 rollout.");
  }
}
