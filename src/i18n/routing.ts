import { defineRouting } from "next-intl/routing";
import { SUPPORTED_LOCALES, DEFAULT_LOCALE } from "./config";

/**
 * URL-routing config for next-intl. All routes get a `/<locale>` prefix
 * (e.g. `/en/products/foo`, `/sr/proizvodi/foo`). The middleware redirects
 * `/` to the user's preferred locale based on:
 *   1. existing NEXT_LOCALE cookie (set by the language switcher),
 *   2. Accept-Language header,
 *   3. the configured default locale.
 *
 * `pathnames` lets us localize the URL segments themselves - "/products"
 * becomes "/proizvodi" in Serbian, "/produkte" in German, etc. - while
 * still resolving to the same route file inside `src/app/[locale]`.
 * Untranslated routes (admin / dashboard / api) are passed through
 * verbatim across all locales: those are operator surfaces with no SEO
 * value and translating them would just add friction for support.
 */
export const routing = defineRouting({
  locales: SUPPORTED_LOCALES,
  defaultLocale: DEFAULT_LOCALE,
  // Always emit the locale prefix - even for the default locale - so
  // hreflang alternates always point at canonical URLs and CDN caches
  // don't collide between locales sharing the same path.
  localePrefix: "always",
  // We move users' locale choice through both the URL and the cookie
  // so that hitting "/" later still routes to the right language.
  localeCookie: {
    name: "NEXT_LOCALE",
    maxAge: 60 * 60 * 24 * 365,
  },
  pathnames: {
    "/": "/",

    // Public storefront - SEO-critical, fully localized.
    "/products": {
      en: "/products",
      sr: "/proizvodi",
      de: "/produkte",
      es: "/productos",
    },
    "/products/[slug]": {
      en: "/products/[slug]",
      sr: "/proizvodi/[slug]",
      de: "/produkte/[slug]",
      es: "/productos/[slug]",
    },
    "/wishlist": {
      en: "/wishlist",
      sr: "/lista-zelja",
      de: "/wunschliste",
      es: "/lista-de-deseos",
    },
    "/brands": {
      en: "/brands",
      sr: "/brendovi",
      de: "/marken",
      es: "/marcas",
    },
    "/brands/[slug]": {
      en: "/brands/[slug]",
      sr: "/brendovi/[slug]",
      de: "/marken/[slug]",
      es: "/marcas/[slug]",
    },
    "/categories/[slug]": {
      en: "/categories/[slug]",
      sr: "/kategorije/[slug]",
      de: "/kategorien/[slug]",
      es: "/categorias/[slug]",
    },
    "/checkout": {
      en: "/checkout",
      sr: "/placanje",
      de: "/kasse",
      es: "/pagar",
    },
    "/checkout/success": {
      en: "/checkout/success",
      sr: "/placanje/uspesno",
      de: "/kasse/erfolgreich",
      es: "/pagar/exito",
    },
    "/checkout/cancel": {
      en: "/checkout/cancel",
      sr: "/placanje/otkazano",
      de: "/kasse/abgebrochen",
      es: "/pagar/cancelado",
    },

    // Auth screens - Clerk catch-all segments. Keep the URL the same
    // across locales: many auth flows hard-code these paths and Clerk's
    // redirects assume English.
    "/sign-in/[[...sign-in]]": "/sign-in/[[...sign-in]]",
    "/sign-up/[[...sign-up]]": "/sign-up/[[...sign-up]]",

    // Operator surfaces - pass-through across locales.
    "/dashboard": "/dashboard",
    "/dashboard/my-products": "/dashboard/my-products",
    "/dashboard/my-products/new": "/dashboard/my-products/new",
    "/dashboard/my-products/[id]": "/dashboard/my-products/[id]",
    "/dashboard/my-products/[id]/edit": "/dashboard/my-products/[id]/edit",
    "/dashboard/orders": "/dashboard/orders",
    "/dashboard/orders/[id]": "/dashboard/orders/[id]",
    "/dashboard/organization": "/dashboard/organization",
    "/dashboard/organization/orders": "/dashboard/organization/orders",
    "/dashboard/organization/orders/[id]": "/dashboard/organization/orders/[id]",

    "/admin": "/admin",
    "/admin/products": "/admin/products",
    "/admin/products/new": "/admin/products/new",
    "/admin/products/bulk": "/admin/products/bulk",
    "/admin/products/[id]": "/admin/products/[id]",
    "/admin/products/[id]/edit": "/admin/products/[id]/edit",
    "/admin/products/[id]/history": "/admin/products/[id]/history",
    "/admin/brands": "/admin/brands",
    "/admin/brands/new": "/admin/brands/new",
    "/admin/brands/[id]/edit": "/admin/brands/[id]/edit",
    "/admin/categories": "/admin/categories",
    "/admin/categories/new": "/admin/categories/new",
    "/admin/categories/[id]/edit": "/admin/categories/[id]/edit",
    "/admin/organizations": "/admin/organizations",
    "/admin/users": "/admin/users",

    "/invite/[token]": "/invite/[token]",
  },
});

export type Pathnames = keyof typeof routing.pathnames;
export type AppLocale = (typeof routing.locales)[number];
