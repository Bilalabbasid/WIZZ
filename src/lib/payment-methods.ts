import { SITE_CONFIG } from "./config";

export type PaymentMethodId = "CASH_ON_DELIVERY" | "ONLINE_SANDBOX";

export interface PaymentMethodOption {
  id: PaymentMethodId;
  label: string;
  description: string;
}

/**
 * Online payments exist only as a sandbox adapter. No live Pakistani PSP
 * (Safepay, PayFast, Kuickpay) adapter is implemented, so the sandbox is never
 * offered when NODE_ENV=production. Cash on delivery is the only production
 * method until a provider adapter is built and verified.
 */
export function isSandboxPaymentEnabled(): boolean {
  return (
    process.env.NODE_ENV !== "production" &&
    (process.env.PAYMENT_PROVIDER || "LOCAL_SANDBOX") === "LOCAL_SANDBOX"
  );
}

export function isCodEnabled(): boolean {
  return SITE_CONFIG.cod.enabled && process.env.FEATURE_COD !== "false";
}

export function getEnabledPaymentMethods(): PaymentMethodOption[] {
  const methods: PaymentMethodOption[] = [];
  if (isCodEnabled()) {
    methods.push({
      id: "CASH_ON_DELIVERY",
      label: "Cash on Delivery",
      description: `Pay in cash when the courier delivers your parcel. Available for orders up to Rs. ${(
        SITE_CONFIG.cod.maxOrderLimitMinor / 100
      ).toLocaleString("en-PK")}.`,
    });
  }
  if (isSandboxPaymentEnabled()) {
    methods.push({
      id: "ONLINE_SANDBOX",
      label: "Online payment (test mode)",
      description: "Simulated gateway for development and staging only. No money is charged.",
    });
  }
  return methods;
}

export function assertPaymentMethodAllowed(method: string, totalMinor: number): PaymentMethodId {
  if (method === "CASH_ON_DELIVERY") {
    if (!isCodEnabled()) throw new Error("PAYMENT_METHOD_UNAVAILABLE: Cash on delivery is not currently available.");
    if (totalMinor > SITE_CONFIG.cod.maxOrderLimitMinor) {
      throw new Error(
        `COD_LIMIT_EXCEEDED: Cash on delivery is available for orders up to Rs. ${(
          SITE_CONFIG.cod.maxOrderLimitMinor / 100
        ).toLocaleString("en-PK")}. Please reduce your order value.`
      );
    }
    return "CASH_ON_DELIVERY";
  }
  if (method === "ONLINE_SANDBOX") {
    if (!isSandboxPaymentEnabled()) {
      throw new Error("PAYMENT_METHOD_UNAVAILABLE: This payment method is not available.");
    }
    return "ONLINE_SANDBOX";
  }
  throw new Error("PAYMENT_METHOD_UNAVAILABLE: Unknown payment method.");
}
