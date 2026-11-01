import type { DemoRole } from "./demoAccounts";
import { DEMO_NEXT_PARAM } from "./demoSignIn";

/**
 * The one-click demo sign-in link (`/api/demo/sign-in`), carrying where the
 * visitor should come back to.
 *
 * `from` may be a full URL (Clerk's `redirect_url`) or a path: only its path
 * and query are forwarded, whatever the host. That is safe - a path is read on
 * this site - and needs no `window`, so the server and the client render the
 * same href. The route validates the path and decides whether the role may go
 * there (demoReturnPath); nothing here is trusted.
 */
export function demoSignInHref(role: DemoRole, locale: string, from?: string | null): string {
  const params = new URLSearchParams({ as: role, locale });
  if (from) {
    try {
      const url = new URL(from, "https://demo.invalid");
      params.set(DEMO_NEXT_PARAM, url.pathname + url.search);
    } catch {
      // Unparseable: sign in without a way back, to the role's home.
    }
  }
  return `/api/demo/sign-in?${params.toString()}`;
}
