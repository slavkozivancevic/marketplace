import { routing } from "@/i18n/routing";
import type { Locale } from "@/i18n/config";
import { routeKeyOf } from "@/lib/seo/appRoutes";
import type { DemoRole } from "./demoAccounts";

/** Where each demo account starts: the screen that shows off its role. */
const LANDING = {
  buyer: "/products",
  seller: "/dashboard",
  admin: "/admin",
} as const satisfies Record<DemoRole, keyof typeof routing.pathnames>;

/**
 * The localized landing path of a demo account, e.g. `/sr/proizvodi`. Read
 * straight from `routing.pathnames` - the map `getPathname` uses - so this
 * stays a plain function a route handler and a unit test can both call.
 */
export function demoLandingPath(role: DemoRole, locale: Locale): string {
  const entry: string | Record<Locale, string> = routing.pathnames[LANDING[role]];
  return `/${locale}${typeof entry === "string" ? entry : entry[locale]}`;
}

/** The query parameter that carries where the visitor was before a demo sign-in. */
export const DEMO_NEXT_PARAM = "next";

/** Routes a demo account never returns to: a sign-in loop, or an invite bound to someone else's email. */
const NEVER = ["/sign-in", "/sign-up", "/invite"];
/** What the buyer does and the shared seller and admin may not (see demoAccounts.ts). */
const BUYER_ONLY = ["/cart", "/checkout", "/wishlist", "/messages"];
/** Selling screens: the buyer has no organization to show them for. */
const SELLER_OR_ADMIN = ["/dashboard/my-products", "/dashboard/organization"];
const ADMIN_ONLY = ["/admin"];

const under = (key: string, prefixes: string[]) =>
  prefixes.some((p) => key === p || key.startsWith(`${p}/`));

/** May this demo account land on this route, or would it only see a refusal there? */
function roleMayOpen(role: DemoRole, key: string): boolean {
  if (under(key, NEVER)) return false;
  if (under(key, BUYER_ONLY)) return role === "buyer";
  if (under(key, SELLER_OR_ADMIN)) return role !== "buyer";
  if (under(key, ADMIN_ONLY)) return role === "admin";
  return true;
}

/**
 * `next` as a path of this site, with its route key, or null. `next` is
 * untrusted (a query parameter anyone can write), so only a path is accepted:
 * no scheme, no `//host`, no backslash tricks, and it is re-read against a
 * throwaway origin so nothing but pathname and query survive. Then it must
 * carry a locale and match a route - by route key, so `/sr/korpa` and
 * `/en/cart` are the same decision.
 */
export function safeLocalPath(next: string | null | undefined): { path: string; key: string } | null {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return null;
  try {
    const url = new URL(next, "https://demo.invalid");
    if (url.origin !== "https://demo.invalid") return null;
    const key = routeKeyOf(url.pathname);
    return key === null ? null : { path: url.pathname + url.search, key };
  } catch {
    return null;
  }
}

/**
 * Where a demo sign-in sends the visitor: back to `next` - the page they were
 * on, or the one sign-in interrupted (checkout, say) - when it is a page of
 * this site the role can use, else the role's own home.
 */
export function demoReturnPath(role: DemoRole, locale: Locale, next: string | null | undefined): string {
  const safe = safeLocalPath(next);
  return safe && roleMayOpen(role, safe.key) ? safe.path : demoLandingPath(role, locale);
}

/**
 * The sign-in URL that redeems a Clerk sign-in token. Clerk's `<SignIn />`
 * picks `__clerk_ticket` up by itself and then follows `redirect_url` - the
 * role's home unless a checked `returnPath` (see demoReturnPath) is given.
 */
export function demoTicketUrl(
  appUrl: string,
  role: DemoRole,
  locale: Locale,
  ticket: string,
  returnPath: string = demoLandingPath(role, locale),
): URL {
  // Sign-in is one optional catch-all route whose segment is the same in
  // every locale (see routing.pathnames).
  const url = new URL(`/${locale}/sign-in`, appUrl);
  url.searchParams.set("__clerk_ticket", ticket);
  url.searchParams.set("redirect_url", new URL(returnPath, appUrl).toString());
  return url;
}

/** The query parameter that tells the sign-in page a demo sign-in was refused for now. */
export const DEMO_BUSY_PARAM = "demo_busy";

/**
 * Where a rate-limited demo click lands: the sign-in page, which says how long
 * to wait, rather than the bare 429 body a route handler would otherwise show
 * a person who just clicked a link. Keeps where they were headed in
 * `redirect_url`, so the next try from that page still returns there.
 */
export function demoBusyUrl(
  appUrl: string,
  locale: Locale,
  retryAfterSec: number,
  next?: string | null,
): URL {
  const url = new URL(`/${locale}/sign-in`, appUrl);
  url.searchParams.set(DEMO_BUSY_PARAM, String(Math.max(1, Math.ceil(retryAfterSec))));
  // Checked here, not just passed through: Clerk's own form follows
  // `redirect_url` after an ordinary sign-in too.
  const safe = safeLocalPath(next);
  if (safe && !under(safe.key, NEVER)) url.searchParams.set("redirect_url", safe.path);
  return url;
}
