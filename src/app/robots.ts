import type { MetadataRoute } from "next";
import { env } from "@/env/server";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = env.APP_URL.replace(/\/$/, "");
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          // Operator surfaces shouldn't be crawled.
          "/admin/",
          "/dashboard/",
          "/checkout/",
          "/api/",
          "/sign-in",
          "/sign-up",
          // Locale-prefixed variants (all routes are /[locale]/... now).
          "/*/admin/",
          "/*/dashboard/",
          "/*/checkout/",
          "/*/sign-in",
          "/*/sign-up",
          // Localized pathname aliases for /checkout (the only public-
          // surface route with locale-translated slugs).
          "/*/placanje/",
          "/*/kasse/",
          "/*/pagar/",
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
