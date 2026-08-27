import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import createIntlMiddleware from "next-intl/middleware";
import { NextResponse } from "next/server";
import { routing } from "@/i18n/routing";
import { prisma } from "@/core/db/prisma";
import { SluggedEntityType } from "@/generated/prisma/client";
import { notFoundResponse } from "@/lib/seo/notFoundResponse";
import { resolveRetiredSlug } from "@/lib/seo/slugHistory";
import { isScannerPath } from "@/lib/security/scannerPaths";
import {
  type EntityDetail,
  isUnservableStorefrontPath,
  parseEntityDetail,
} from "@/lib/seo/storefrontPaths";
import { THEME_COOKIE_NAME } from "@/providers/theme/constants";

const intlMiddleware = createIntlMiddleware(routing);

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Same-origin gate for state-changing API requests (CSRF defense). Route
 * handlers - unlike Server Actions, which Next guards automatically - have no
 * built-in origin check, so a cross-site page could POST to them with the
 * user's cookies. We block clearly cross-site browser requests.
 *
 * Primary signal is `Sec-Fetch-Site` (sent by all modern browsers); we allow
 * everything except an explicit `cross-site`. Requests with no fetch-metadata
 * and no Origin are NOT browser-driven CSRF (webhooks from Stripe/Clerk, the
 * notifications Lambda hitting internal APIs, native clients) and are allowed -
 * those paths defend themselves with signature / x-api-key checks.
 */
function isSameOriginRequest(req: Parameters<typeof intlMiddleware>[0]): boolean {
  const secFetchSite = req.headers.get("sec-fetch-site");
  if (secFetchSite) return secFetchSite !== "cross-site";

  const origin = req.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === req.nextUrl.host;
  } catch {
    return false;
  }
}

/**
 * Prisma's discriminator for the slug-history lookup, keyed by the kind that
 * `parseEntityDetail` reports.
 */
const ENTITY_TYPE: Record<"product" | "category" | "brand", SluggedEntityType> = {
  product: "PRODUCT",
  category: "CATEGORY",
  brand: "BRAND",
};

/** True when the slug resolves to something the page would actually render. */
async function entityExists(entity: EntityDetail): Promise<boolean> {
  const { kind, slug } = entity;
  if (kind === "product") {
    const row = await prisma.product.findFirst({
      where: { status: "PUBLISHED", deletedAt: null, translations: { some: { slug } } },
      select: { id: true },
    });
    return !!row;
  }
  if (kind === "category") {
    const row = await prisma.categoryTranslation.findFirst({
      where: { slug },
      select: { categoryId: true },
    });
    return !!row;
  }
  const row = await prisma.brandTranslation.findFirst({
    where: { slug },
    select: { brandId: true },
  });
  return !!row;
}

/**
 * Routes that don't require authentication. Matched against the URL the
 * browser sent (before next-intl rewrites localized segments back to the
 * canonical path), so localized aliases like `/sr/proizvodi/...`,
 * `/de/produkte/...`, and `/es/productos/...` each need their own entry.
 */
const publicRoutes = createRouteMatcher([
  "/",
  "/(en|sr|de|es)",
  // Non-locale-prefixed sign-in/up too: Clerk's `auth.protect()` redirects
  // using `NEXT_PUBLIC_CLERK_SIGN_IN_URL` which is set to `/sign-in` (locale-
  // agnostic). Without these, the unprefixed URL would re-trigger
  // `auth.protect()` and recurse. Letting them through lets the intl
  // middleware redirect to `/<locale>/sign-in`.
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/(en|sr|de|es)/sign-in(.*)",
  "/(en|sr|de|es)/sign-up(.*)",
  "/api(.*)",
  // Storefront across every localized URL alias.
  "/(en|sr|de|es)/products(.*)",
  "/(en|sr|de|es)/proizvodi(.*)",
  "/(en|sr|de|es)/produkte(.*)",
  "/(en|sr|de|es)/productos(.*)",
  // Brand pages across every localized alias.
  "/(en|sr|de|es)/brands(.*)",
  "/(en|sr|de|es)/brendovi(.*)",
  "/(en|sr|de|es)/marken(.*)",
  "/(en|sr|de|es)/marcas(.*)",
  // Category pages across every localized alias.
  "/(en|sr|de|es)/categories(.*)",
  "/(en|sr|de|es)/kategorije(.*)",
  "/(en|sr|de|es)/kategorien(.*)",
  "/(en|sr|de|es)/categorias(.*)",
  // Crawler-facing static routes that Next serves directly (no locale,
  // no auth). Keeping them out of `auth.protect()` so search engines can
  // fetch them anonymously.
  "/sitemap.xml",
  "/robots.txt",
]);

/**
 * Pipeline:
 *   1. Clerk runs first to enforce auth on private routes.
 *   2. API routes bypass next-intl entirely - they are locale-agnostic and
 *      downstream handlers should never see request bodies rewritten by
 *      the i18n middleware.
 *   3. Everything else flows through next-intl: it redirects unprefixed
 *      URLs to the user's locale (URL > NEXT_LOCALE cookie >
 *      Accept-Language > default), and rewrites localized segments like
 *      `/sr/proizvodi/...` to the canonical app-router path
 *      `/sr/products/...` so a single page.tsx serves all locale variants.
 */
// Paths that must NOT be locale-prefixed - special files Next.js serves
// directly. The intl middleware would otherwise redirect e.g. `/sitemap.xml`
// to `/en/sitemap.xml`, which doesn't exist as a route handler.
const LOCALE_AGNOSTIC_FILES = new Set([
  "/sitemap.xml",
  "/robots.txt",
  "/favicon.ico",
  "/manifest.webmanifest",
]);

export default clerkMiddleware(async (auth, req) => {
  const { pathname } = req.nextUrl;

  // Vulnerability scanners, answered before anything else runs. Every error
  // logged on staging in 24h came from these paths and none from a real page;
  // letting them through renders a page, which can wake Neon (metered on the
  // Free plan) and fills the AppErrors metric whose alarm pages a human.
  // 404 rather than 403: it tells the scanner nothing it did not already know.
  if (isScannerPath(pathname)) {
    return new NextResponse(null, { status: 404 });
  }

  if (!publicRoutes(req)) {
    await auth.protect();
  }

  if (pathname.startsWith("/api/") || LOCALE_AGNOSTIC_FILES.has(pathname)) {
    // CSRF: reject cross-site state-changing calls to API route handlers.
    // Webhooks (signature-verified) and internal APIs (x-api-key) carry no
    // browser origin headers, so they pass through untouched.
    if (MUTATING_METHODS.has(req.method) && !isSameOriginRequest(req)) {
      return new NextResponse("Cross-origin request blocked", { status: 403 });
    }
    return NextResponse.next();
  }

  // Storefront URLs whose shape no route can serve - extra path depth under
  // `/products`, `/brands`, `/categories`, or a bare `/categories` that has no
  // listing page. `publicRoutes` matches those prefixes with `(.*)`, so they
  // clear auth, match no page, and used to land on the `[...rest]` catch-all,
  // which answers 200 under PPR. Decided on the URL alone, so no DB round-trip.
  if (isUnservableStorefrontPath(pathname)) {
    const locale = pathname.split("/").filter(Boolean)[0];
    return notFoundResponse(locale, req.cookies.get(THEME_COOKIE_NAME)?.value);
  }

  // Entity-detail URLs whose slug doesn't resolve are handled here, before the
  // page renders. A renamed slug 308-redirects to the entity's current slug
  // (slug history - keeps old links and their SEO alive); a genuinely missing
  // one gets a real 404 (see notFoundResponse for why this can't be a normal
  // page under PPR). Everything else flows through next-intl as usual.
  const entity = parseEntityDetail(pathname);
  if (entity) {
    // Fail-open: a DB hiccup during the existence check must never turn a real
    // page into a 404, so treat an error as "exists" and continue.
    let exists = true;
    try {
      exists = await entityExists(entity);
    } catch {
      exists = true;
    }
    if (!exists) {
      const currentSlug = await resolveRetiredSlug(
        ENTITY_TYPE[entity.kind],
        entity.locale,
        entity.slug,
      ).catch(() => null);
      if (currentSlug) {
        const url = req.nextUrl.clone();
        url.pathname = `/${entity.locale}/${entity.segment}/${encodeURIComponent(currentSlug)}`;
        return NextResponse.redirect(url, 308);
      }
      const theme = req.cookies.get(THEME_COOKIE_NAME)?.value;
      return notFoundResponse(entity.locale, theme);
    }
  }

  return intlMiddleware(req);
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|m?js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
