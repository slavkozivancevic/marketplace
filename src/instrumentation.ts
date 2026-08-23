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
 * Central capture for ALL uncaught server errors - route handlers, Server
 * Components, and Server Actions - with zero call-site changes. Next invokes
 * this for any error it surfaces during request handling.
 */
export function onRequestError(
  error: unknown,
  request: { path?: string; method?: string },
  context: { routerKind?: string; routePath?: string; renderSource?: string },
): void {
  captureError(error, {
    source: "onRequestError",
    path: request?.path,
    method: request?.method,
    routerKind: context?.routerKind,
    routePath: context?.routePath,
    renderSource: context?.renderSource,
  });
}
