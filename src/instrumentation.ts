import { captureError } from "@/lib/logger";

/**
 * Next.js instrumentation. `register` runs once at server startup (reserved for
 * boot-time wiring like Sentry.init when an external tracker is added).
 */
export async function register(): Promise<void> {
  // No-op today - the seam for external monitoring init lives here.
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
