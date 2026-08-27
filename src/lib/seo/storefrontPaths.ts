import { isLocale } from "@/i18n/config";

/**
 * Shape analysis for public storefront URLs, done in the proxy before a page
 * renders.
 *
 * WHY THIS IS NOT A NORMAL not-found PAGE. With `cacheComponents` (PPR) every
 * `/[locale]/...` route ships a prerendered shell that is flushed - status line
 * included - before the dynamic part runs, so a deep `notFound()` can never
 * change the 200 that already went out. Measured on staging after deploying an
 * `await connection()` in the `[...rest]` catch-all: the correct not-found page
 * rendered, with its `noindex`, still under HTTP 200. A response returned
 * straight from the proxy carries the status we set, so this is the only place
 * a real 404 can be produced while PPR stays on for every valid page.
 *
 * Only storefront segments are examined here. Everything else that misses
 * (`/{locale}/dashboard/...`, `/{locale}/admin/...`) sits behind
 * `auth.protect()`, which answers with a 307 to sign-in - not a page, so not a
 * soft 200 - and no route table has to be mirrored in middleware. That matters:
 * enumerating the app's 50+ routes up here would silently 404 every new route
 * somebody adds.
 */

// First URL segment (across locale aliases) -> entity whose slug we verify.
export const ENTITY_SEGMENTS: Record<string, "product" | "category" | "brand"> = {
  products: "product", proizvodi: "product", produkte: "product", productos: "product",
  brands: "brand", brendovi: "brand", marken: "brand", marcas: "brand",
  categories: "category", kategorije: "category", kategorien: "category", categorias: "category",
};

/**
 * Storefront kinds that have a listing page at `/{locale}/{segment}`.
 * Categories deliberately have none - they exist only as `[slug]` detail pages
 * - so a bare `/{locale}/categories` is a miss, not a listing.
 */
const KINDS_WITH_LISTING = new Set(["product", "brand"]);

const ENTITY_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface EntityDetail {
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
export function parseEntityDetail(pathname: string): EntityDetail | null {
  const parts = pathname.split("/").filter(Boolean); // [locale, segment, slug]
  if (parts.length !== 3) return null;
  const kind = ENTITY_SEGMENTS[parts[1]];
  if (!kind) return null;
  const slug = decodeURIComponent(parts[2]);
  if (ENTITY_UUID_RE.test(slug)) return null;
  return { kind, locale: parts[0], segment: parts[1], slug };
}

/**
 * True when a storefront URL has a shape no route can ever serve, so it is a
 * 404 on the URL alone - no database lookup needed.
 *
 * These reach a page at all only because `publicRoutes` matches storefront
 * prefixes with `(.*)`, which lets arbitrary extra depth through auth. The
 * valid shapes are exactly two: `/{locale}/{segment}` (listing) and
 * `/{locale}/{segment}/{slug}` (detail, existence-checked separately against
 * the database). Anything deeper - `/en/products/foo/bar` - matched no page and
 * fell through to the `[...rest]` catch-all, which answered 200.
 *
 * Requires a real locale in the first segment so unprefixed URLs keep flowing
 * to next-intl for their locale redirect instead of being 404'd here.
 */
export function isUnservableStorefrontPath(pathname: string): boolean {
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length < 2) return false;
  if (!isLocale(parts[0])) return false;

  const kind = ENTITY_SEGMENTS[parts[1]];
  if (!kind) return false;

  if (parts.length > 3) return true;
  if (parts.length === 2) return !KINDS_WITH_LISTING.has(kind);
  return false;
}
