import type { MetadataRoute } from "next";
import { SITE_CONFIG } from "@/lib/config";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = SITE_CONFIG.canonicalUrl;

  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/products", "/categories/", "/policies/", "/contact", "/sell"],
        disallow: [
          "/api/",
          "/admin/",
          "/seller/",
          "/cart",
          "/checkout",
          "/account",
          "/orders/",
          "/search", // Prevent crawl budget waste and duplicate indexation on internal search pages
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
