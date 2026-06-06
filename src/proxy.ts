import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import createIntlMiddleware from "next-intl/middleware";
import { NextResponse } from "next/server";
import { routing } from "@/i18n/routing";
import { prisma } from "@/core/db/prisma";
import { SluggedEntityType } from "@/generated/prisma/client";
import { notFoundResponse } from "@/lib/seo/notFoundResponse";
import { resolveRetiredSlug } from "@/lib/seo/slugHistory";
import { THEME_COOKIE_NAME } from "@/providers/theme/constants";

const intlMiddleware = createIntlMiddleware(routing);

// First URL segment (across locale aliases) -> entity whose slug we verify.
const ENTITY_SEGMENTS: Record<string, "product" | "category" | "brand"> = {
  products: "product", proizvodi: "product", produkte: "product", productos: "product",
  brands: "brand", brendovi: "brand", marken: "brand", marcas: "brand",
  categories: "category", kategorije: "category", kategorien: "category", categorias: "category",
};

const ENTITY_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * True when the URL is an entity-detail page (`/{locale}/{products|...}/{slug}`)
 * whose slug resolves to nothing the page would render - i.e. a genuine 404.
 *
 * Why this lives in middleware: with `cacheComponents` (PPR) the prerendered
 * shell flushes a 200 before the page's deep `notFound()` runs, so notFound()
 * can never set a 404 status. Verifying existence up here lets us return a real
 * 404 while keeping PPR on for every valid page. Fail-open: any error resolves
 * to `false`, so a DB hiccup never turns a real page into a 404.
 */
const ENTITY_TYPE: Record<"product" | "category" | "brand", SluggedEntityType> = {
  product: "PRODUCT",
  category: "CATEGORY",
  brand: "BRAND",
};

interface EntityDetail {
  kind: "product" | "category" | "brand";
  locale: string;
  segment: string; // the localized URL segment as typed (e.g. "proizvodi")
  slug: string;
}

/**
 * Parses an entity-detail URL (`/{locale}/{products|...}/{slug}`) into its
 * parts, or null when the path isn't one (so the request flows on normally).
 * Legacy `/{segment}/<uuid>` URLs are excluded - the page 308-redirects those.
 */
function parseEntityDetail(pathname: string): EntityDetail | null {
  const parts = pathname.split("/").filter(Boolean); // [locale, segment, slug]
  if (parts.length !== 3) return null;
  const kind = ENTITY_SEGMENTS[parts[1]];
  if (!kind) return null;
  const slug = decodeURIComponent(parts[2]);
  if (ENTITY_UUID_RE.test(slug)) return null;
  return { kind, locale: parts[0], segment: parts[1], slug };
}

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
  if (!publicRoutes(req)) {
    await auth.protect();
  }

  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/api/") || LOCALE_AGNOSTIC_FILES.has(pathname)) {
    return NextResponse.next();
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
