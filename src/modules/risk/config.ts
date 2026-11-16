/**
 * Fraud and abuse limits. Every threshold the risk rules use lives here so they can be
 * reviewed and tuned in one place. Limits are deliberately conservative for a COD-first
 * Pakistani marketplace; none of them freezes money automatically.
 */
export const RISK_LIMITS = {
  /** Cash-on-delivery orders allowed per normalised phone, email or account in 24 hours. */
  codOrdersPer24h: 5,
  /** Open (not delivered / cancelled / refunded) COD orders allowed per phone or account. */
  openCodOrdersPerPhone: 3,
  /** Order placement attempts allowed per client IP per hour (in-memory sliding window). */
  orderAttemptsPerIpPerHour: 20,
  /** Customer-cancelled COD orders (per phone / email / account) that switch off guest COD. */
  codCustomerCancellations: 3,
  codCustomerCancellationWindowDays: 30,
  /** Refunded returns per customer that put the customer in the review queue. */
  refundedReturns: 3,
  refundedReturnsWindowDays: 90,
  /** A customer is flagged at most once per rule within this many days. */
  flagDedupeDays: 30,
} as const;

/** Audit actions written by the risk rules. All start with RISK_ so the review queue can find them. */
export const RISK_RULES = {
  IP_VELOCITY: "RISK_IP_VELOCITY",
  COD_VELOCITY: "RISK_COD_VELOCITY",
  COD_OPEN_ORDERS: "RISK_COD_OPEN_ORDERS",
  COD_CANCELLATION_ABUSE: "RISK_COD_CANCELLATION_ABUSE",
  COUPON_REUSE: "RISK_COUPON_REUSE",
  REFUND_ABUSE: "RISK_REFUND_ABUSE",
  PAYMENT_MISMATCH: "RISK_PAYMENT_MISMATCH",
  CHARGEBACK: "RISK_CHARGEBACK",
} as const;

export type RiskRule = (typeof RISK_RULES)[keyof typeof RISK_RULES];

export const RISK_REVIEWED_ACTION = "RISK_REVIEWED";

export const RISK_RULE_LABELS: Record<RiskRule, string> = {
  RISK_IP_VELOCITY: "Too many order attempts from one IP",
  RISK_COD_VELOCITY: "Too many COD orders in 24 hours",
  RISK_COD_OPEN_ORDERS: "Too many open COD orders",
  RISK_COD_CANCELLATION_ABUSE: "Repeated COD cancellations",
  RISK_COUPON_REUSE: "Coupon reused by the same customer",
  RISK_REFUND_ABUSE: "Many refunded returns",
  RISK_PAYMENT_MISMATCH: "Payment event did not match the order",
  RISK_CHARGEBACK: "Chargeback / payment dispute",
};

export const RISK_RULE_VALUES = Object.values(RISK_RULES) as RiskRule[];
