import { DEFAULT_LOCALE, SUPPORTED_LOCALES, isLocale } from "@/i18n/config";
import { routing } from "@/i18n/routing";

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
 * SCOPE. This module settles storefront shapes only - the ones decidable from
 * the URL alone, plus one existence query for detail URLs. It is NOT the
 * general "does this route exist" check; that lives in `./appRoutes`, which
 * derives the whole route table from `routing.pathnames`. Both are needed.
 * An earlier version of this comment claimed non-storefront misses were already
 * covered because they sit behind `auth.protect()`. That holds only for
 * signed-out requests: a signed-in user hitting `/en/dashboard/typo` clears
 * `auth.protect()` and lands on the `[...rest]` catch-all under HTTP 200.
 * `appRoutes` is what closes that, not this file.
 *
 * EVERYTHING BELOW IS DERIVED FROM `routing.pathnames`. It used to be a
 * hand-copied table. Renaming a localized segment there (say `es: "/productos"`
 * to `"/articulos"`) left this file stale with every check still green, and for
 * that entire locale the soft-200 came back, `entityExists` stopped running,
 * and the SlugHistory 308 silently stopped firing.
 */

export type EntityKind = "product" | "category" | "brand";

/**
 * The `routing.pathnames` keys each entity kind is served by. A kind has a
 * bare-listing URL only if its `listing` key is actually present in the table -
 * categories have detail pages only, so `/{locale}/categories` is a miss.
 */
const ENTITY_ROUTE_KEYS: Record<EntityKind, { listing: string; detail: string }> = {
  product: { listing: "/products", detail: "/products/[slug]" },
  brand: { listing: "/brands", detail: "/brands/[slug]" },
  category: { listing: "/categories", detail: "/categories/[slug]" },
};

// `routing.pathnames` is typed as a literal map, so asking about a key that may
// legitimately not be there (there is no `/categories` listing today) is a type
// error. Read it through one widened view rather than casting at every call.
const PATHNAMES = routing.pathnames as Record<string, string | Record<string, string>>;

/** Every localized form of one pathnames key, across all locales. */
export function localizedTemplates(key: string): string[] {
  const entry = PATHNAMES[key];
  if (!entry) return [];
  if (typeof entry === "string") return [entry];
  return SUPPORTED_LOCALES.map((locale) => entry[locale]).filter(Boolean);
}

function firstSegment(template: string): string {
  return template.split("/").filter(Boolean)[0] ?? "";
}

const ENTITY_KINDS = Object.keys(ENTITY_ROUTE_KEYS) as EntityKind[];

/** First URL segment (across locale aliases) -> entity whose slug we verify. */
export const ENTITY_SEGMENTS: Record<string, EntityKind> = Object.fromEntries(
  ENTITY_KINDS.flatMap((kind) =>
    localizedTemplates(ENTITY_ROUTE_KEYS[kind].detail).map(
      (template) => [firstSegment(template), kind] as const,
    ),
  ),
);

/** Storefront kinds that have a listing page at `/{locale}/{segment}`. */
const KINDS_WITH_LISTING = new Set<EntityKind>(
  ENTITY_KINDS.filter((kind) => localizedTemplates(ENTITY_ROUTE_KEYS[kind].listing).length > 0),
);

/**
 * The localized first segment for one kind, e.g. `("brand", "de") -> "marken"`.
 * Falls back to the default locale so a junk locale still yields a real link.
 */
export function localizedSegment(kind: EntityKind, locale: string): string {
  const entry = PATHNAMES[ENTITY_ROUTE_KEYS[kind].detail];
  const lang = isLocale(locale) ? locale : DEFAULT_LOCALE;
  if (typeof entry === "string") return firstSegment(entry);
  return firstSegment(entry?.[lang] ?? entry?.[DEFAULT_LOCALE] ?? "");
}

/**
 * `ENTITY_SEGMENTS` is indexed with an arbitrary URL segment, so a plain
 * property read would resolve inherited members: `/en/valueOf/x` would hand
 * back a truthy `kind` outside the union and buy a pointless database query -
 * the Neon wake-up cost `isScannerPath` exists to avoid.
 */
function segmentKind(segment: string): EntityKind | null {
  return Object.hasOwn(ENTITY_SEGMENTS, segment) ? ENTITY_SEGMENTS[segment] : null;
}

const ENTITY_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * `decodeURIComponent` throws URIError on a lone or truncated escape
 * (`/en/products/%`, `/de/marken/%E0%A4`). This runs in the proxy, outside any
 * try/catch, so an uncaught throw answers 500 on exactly the malformed URLs
 * this module exists to answer with a 404 - and scanners send those in bursts,
 * which is enough to trip the AppErrors alarm and page a human.
 */
function decodeSlug(raw: string): string | null {
  try {
    return decodeURIComponent(raw);
  } catch {
    return null;
  }
}

export interface EntityDetail {
  kind: EntityKind;
  locale: string;
  segment: string; // the localized URL segment as typed (e.g. "proizvodi")
  slug: string;
  /**
   * The `[slug]` segment is a UUID, i.e. a legacy `/{segment}/<uuid>` link.
   * The page 308-redirects those when the id resolves and calls `notFound()`
   * when it does not - and that `notFound()` is a soft 200 like any other. So
   * they still need an existence check, just one keyed by id instead of slug,
   * with no slug-history lookup afterwards: a UUID was never a retired slug.
   */
  isId: boolean;
}

/**
 * Parses an entity-detail URL (`/{locale}/{products|...}/{slug}`) into its
 * parts, or null when the path isn't one (so the request flows on normally).
 * A malformed percent-encoded slug is null too - `isUnservableStorefrontPath`
 * has already answered those with a 404 by the time this runs.
 */
export function parseEntityDetail(pathname: string): EntityDetail | null {
  const parts = pathname.split("/").filter(Boolean); // [locale, segment, slug]
  if (parts.length !== 3) return null;
  const kind = segmentKind(parts[1]);
  if (!kind) return null;
  const slug = decodeSlug(parts[2]);
  if (slug === null) return null;
  return {
    kind,
    locale: parts[0],
    segment: parts[1],
    slug,
    isId: ENTITY_UUID_RE.test(slug),
  };
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

  const kind = segmentKind(parts[1]);
  if (!kind) return false;

  if (parts.length > 3) return true;
  if (parts.length === 2) return !KINDS_WITH_LISTING.has(kind);
  // A slug that cannot be decoded names no entity, so it is unservable on the
  // URL alone - same class as extra depth, and it keeps the malformed case out
  // of the database path entirely.
  return decodeSlug(parts[2]) === null;
}
