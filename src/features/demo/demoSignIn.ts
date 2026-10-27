import { routing } from "@/i18n/routing";
import type { Locale } from "@/i18n/config";
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

/**
 * The sign-in URL that redeems a Clerk sign-in token. Clerk's `<SignIn />`
 * picks `__clerk_ticket` up by itself and then follows `redirect_url`.
 */
export function demoTicketUrl(appUrl: string, role: DemoRole, locale: Locale, ticket: string): URL {
  // Sign-in is one optional catch-all route whose segment is the same in
  // every locale (see routing.pathnames).
  const url = new URL(`/${locale}/sign-in`, appUrl);
  url.searchParams.set("__clerk_ticket", ticket);
  url.searchParams.set("redirect_url", new URL(demoLandingPath(role, locale), appUrl).toString());
  return url;
}
