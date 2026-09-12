import { captureError } from "@/lib/logger";

/**
 * Next.js instrumentation. `register` runs once at server startup, per runtime.
 */
export async function register(): Promise<void> {
  // Importing the request-context module is what registers the logger's context
  // provider, so every log line carries its `requestId`. It is a dynamic import
  // behind a runtime guard because it pulls in `node:async_hooks`, which does
  // not exist in the edge runtime - Next calls `register()` there too.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("@/lib/observability/requestContext");
  }

  // SEAM: external monitoring init (e.g. Sentry.init) belongs here too.
}

/**
 * `redirect()` and `notFound()` are implemented by throwing, and Next tags
 * those throws with a digest. They are control flow, not failures.
 *
 * WHY THIS MATTERS HERE. Every page that bounces a signed-out visitor - the
 * dashboard, the wishlist, the admin home - calls `redirect()` on the way out.
 * Crawlers walk those URLs constantly while signed out, so each visit landed in
 * the log at error level and counted toward the `AppErrors` metric, whose alarm
 * fires at 5 in 5 minutes. On staging that was the entire residue once scanner
 * traffic was filtered: `/en/dashboard`, `/de/wunschliste`, `/en/wishlist`,
 * `/es/dashboard` - all of them working exactly as designed.
 *
 * Deliberately narrow: only these two digests are dropped. Anything thrown
 * inside a page, including a failure on the way to the redirect, still reports.
 */
function isControlFlowSignal(error: unknown): boolean {
  const digest = (error as { digest?: unknown } | null)?.digest;
  if (typeof digest !== "string") return false;
  return (
    digest.startsWith("NEXT_REDIRECT") ||
    digest.startsWith("NEXT_HTTP_ERROR_FALLBACK") ||
    digest === "NEXT_NOT_FOUND"
  );
}

/**
 * Central capture for ALL uncaught server errors - route handlers, Server
 * Components, and Server Actions - with zero call-site changes. Next invokes
 * this for any error it surfaces during request handling.
 */
export function onRequestError(
  error: unknown,
  request: { path?: string; method?: string },
  context: { routerKind?: string; routePath?: string; renderSource?: string },
): void {
  if (isControlFlowSignal(error)) return;

  captureError(error, {
    source: "onRequestError",
    path: request?.path,
    method: request?.method,
    routerKind: context?.routerKind,
    routePath: context?.routePath,
    renderSource: context?.renderSource,
  });
}
