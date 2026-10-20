// WIZZ.PK Platform Configuration Service

export const SITE_CONFIG = {
  brandName: process.env.BRAND_NAME || "WIZZ.PK",
  canonicalUrl: process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "https://wizz.pk",
  defaultCurrency: process.env.DEFAULT_CURRENCY || "PKR",
  defaultLocale: process.env.DEFAULT_LOCALE || "en-PK",
  supportEmail: process.env.SUPPORT_EMAIL || "support@wizz.pk",
  supportPhone: process.env.SUPPORT_PHONE || "", // Configurable; not invented
  flagshipSellerId: "seller_wizz_pk_1p",
  flagshipSellerName: "WIZZ.PK Direct",
  sessionCookieName: process.env.SESSION_COOKIE_NAME || "wizz_session",
  sessionExpiryDays: Number(process.env.SESSION_EXPIRY_DAYS || 7),
  reservationExpiryMinutes: 15,
  shipping: {
    standardRateMinor: 25000, // PKR 250 standard shipping
    freeShippingThresholdMinor: 300000, // Free delivery above PKR 3,000
    expressRateMinor: 45000, // PKR 450 express delivery
  },
  tax: {
    defaultRatePercent: 0, // Configurable GST / sales tax rate (0% default platform rate)
  },
  cod: {
    enabled: true,
    maxOrderLimitMinor: 5000000, // COD allowed up to PKR 50,000
  },
} as const;
