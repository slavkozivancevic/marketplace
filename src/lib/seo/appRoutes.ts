import { isLocale } from "@/i18n/config";
import { routing } from "@/i18n/routing";
import { localizedTemplates } from "@/lib/seo/storefrontPaths";

/**
 * "Does any route serve this URL?", answered in the proxy from the app's own
 * route table.
 *
 * WHY. Under `cacheComponents` (PPR) a deep `notFound()` cannot set a status -
 * see `storefrontPaths.ts` for the measurement. `storefrontPaths` closes the
 * storefront shapes; everything else that misses still fell through to the
 * `[...rest]` catch-all and answered HTTP 200. For signed-out visitors that was
 * masked by `auth.protect()` returning a 307 to sign-in, which is its own
 * problem: a stale inbound link like `/en/about` redirected Googlebot and
 * uptime monitors to a sign-in page instead of 404ing. For signed-in users
 * nothing masked it at all - `/en/dashboard/typo` rendered 404 content under a
 * 200.
 *
 * WHY THIS IS SAFE TO DO IN MIDDLEWARE. The obvious objection is the one
 * `storefrontPaths` used to state: enumerating the app's 50+ routes up here
 * would silently 404 every new route somebody adds. That objection is about a
 * hand-maintained list. This is not one - the patterns are generated from
 * `routing.pathnames`, which a route must already appear in to be linkable
 * through next-intl, and `appRoutes.test.ts` walks `src/app/(i18n)/[locale]`
 * and fails CI if any `page.tsx` or `route.ts` has no entry. Adding a route
 * without registering it breaks the build, not production.
 *
 * LOCALE-AGNOSTIC ON PURPOSE. A path counts as known if it matches a template
 * for ANY locale, not just the one in the URL. Cross-locale URLs such as
 * `/en/marken` (the German segment under the English prefix) are next-intl's
 * job - it redirects them to the right locale. 404ing them here would pre-empt
 * that redirect and break working links.
 */

const PATHNAMES = routing.pathnames as Record<string, string | Record<string, string>>;

/**
 * `/dashboard/orders/[id]/edit` -> `^/dashboard/orders/[^/]+/edit/?$`.
 * Optional catch-alls (`[[...sign-in]]`) may match zero segments; required
 * catch-alls (`[...rest]`) must match at least one.
 */
function templateToRegex(template: string): RegExp {
  const source = template
    .split("/")
    .filter(Boolean)
    .map((segment) => {
      if (/^\[\[\.\.\..+\]\]$/.test(segment)) return "(?:/[^/]+)*";
      if (/^\[\.\.\..+\]$/.test(segment)) return "(?:/[^/]+)+";
      if (/^\[.+\]$/.test(segment)) return "/[^/]+";
      return `/${segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`;
    })
    .join("");
  return new RegExp(`^${source || "/"}/?$`);
}

const ROUTE_PATTERNS: RegExp[] = Array.from(
  new Set(Object.keys(PATHNAMES).flatMap((key) => localizedTemplates(key))),
).map(templateToRegex);

/**
 * True when the URL carries a real locale prefix but the rest of it matches no
 * route in any locale - a genuine 404 the catch-all would otherwise answer 200.
 *
 * Unprefixed URLs return false: next-intl still has to redirect those to a
 * locale, and 404ing here would pre-empt it.
 */
export function isUnknownLocalePath(pathname: string): boolean {
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length === 0) return false;
  if (!isLocale(parts[0])) return false;

  const rest = `/${parts.slice(1).join("/")}`;
  return !ROUTE_PATTERNS.some((pattern) => pattern.test(rest));
}
