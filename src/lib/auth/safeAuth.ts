import "server-only";
import { auth } from "@clerk/nextjs/server";

const MIDDLEWARE_NOT_DETECTED = "can't detect usage of clerkMiddleware";

/**
 * Wraps Clerk's `auth()` to tolerate Next.js's `cacheComponents` prefetch
 * behavior: when a `<Link>` to this route is visible, Next re-renders the
 * route's Server Component tree in the background to produce the prefetch
 * payload - a throwaway render that never went through `clerkMiddleware()`,
 * so `auth()` throws "Clerk: auth() was called but Clerk can't detect usage
 * of clerkMiddleware()" (see https://clerk.com/err/auth-middleware and
 * https://github.com/vercel/next.js/issues/86182). A real navigation always
 * goes through a proper middleware-wrapped request and never hits this path,
 * so treating it as signed-out here just makes the discarded prefetch render
 * behave like an anonymous visit instead of crashing - which was observed to
 * leave the *real* navigation stuck (Next.js blocks a click on its in-flight
 * prefetch for the same route; an unhandled crash there hangs it).
 *
 * Only use this in Server Component render paths (pages/layouts) that can be
 * prefetched. Route Handlers and Server Actions are never invoked by Next's
 * prefetch - they run only for real requests - so they should keep calling
 * `auth()` directly and let a genuine auth failure surface normally.
 */
export async function safeAuth() {
  try {
    return await auth();
  } catch (error) {
    if (error instanceof Error && error.message.includes(MIDDLEWARE_NOT_DETECTED)) {
      return { userId: null, sessionClaims: null } as Awaited<ReturnType<typeof auth>>;
    }
    throw error;
  }
}
