import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import { logger, setLogContextProvider } from "@/lib/logger";

/**
 * Per-request correlation + counters, carried implicitly through the async call
 * tree so nothing has to be threaded as an argument.
 *
 * SERVER ONLY. `node:async_hooks` does not exist in the browser or the edge
 * runtime, which is why `logger.ts` stays isomorphic and merely *accepts* a
 * context provider - importing this module is what registers it (see the
 * `setLogContextProvider` call below and `src/instrumentation.ts`).
 *
 * Deliberately narrow (ROADMAP #23): we do not observe the whole app. Only the
 * critical paths are wrapped - checkout, the Stripe webhook, and the products
 * API - plus the two global nets that catch everything else regardless of
 * origin: every error, and every slow query.
 */

export type RequestContext = {
  /** Correlates every log line emitted while handling one request. */
  requestId: string;
  /** Logical route name, e.g. "POST /api/webhooks/stripe". */
  route: string;
  startedAt: number;
  /** Incremented by the Prisma extension - the N+1 signal. */
  dbQueries: number;
  /** Cumulative time spent inside the database for this request. */
  dbMs: number;
};

const storage = new AsyncLocalStorage<RequestContext>();

// Registering here (import side effect) rather than having logger.ts import
// this file keeps `node:async_hooks` out of the client bundle entirely.
setLogContextProvider(() => {
  const ctx = storage.getStore();
  return ctx ? { requestId: ctx.requestId, route: ctx.route } : undefined;
});

export function getRequestContext(): RequestContext | undefined {
  return storage.getStore();
}

/**
 * Called by the Prisma client extension for every query. A no-op outside a
 * wrapped request (cron jobs, build-time calls) - the counters only exist to
 * summarise a request.
 */
export function recordDbQuery(durationMs: number): void {
  const ctx = storage.getStore();
  if (!ctx) return;
  ctx.dbQueries += 1;
  ctx.dbMs += durationMs;
}

/**
 * Runs `fn` inside a fresh request context and emits exactly one summary line
 * when it settles:
 *
 *   {"msg":"request","route":"POST /checkout","status":200,"durationMs":412,
 *    "dbQueries":7,"dbMs":233,"requestId":"...","level":"info"}
 *
 * That single line is the source for four of our CloudWatch metric filters
 * (RequestDurationMs, QueriesPerRequest, Http5xx, and the N+1 signal), so it is
 * emitted on the failure path too - a request that throws is exactly the one
 * worth measuring. The error itself is not logged here; it keeps propagating to
 * the existing funnels (`onRequestError`, `handleActionError`) so it is never
 * reported twice.
 */
export async function observeRequest<T>(
  route: string,
  fn: () => Promise<T>,
  options?: { requestId?: string; statusOf?: (result: T) => number },
): Promise<T> {
  const ctx: RequestContext = {
    requestId: options?.requestId ?? randomUUID().slice(0, 8),
    route,
    startedAt: Date.now(),
    dbQueries: 0,
    dbMs: 0,
  };

  return storage.run(ctx, async () => {
    let status = 200;
    try {
      const result = await fn();
      status = options?.statusOf?.(result) ?? 200;
      return result;
    } catch (error) {
      status = 500;
      throw error;
    } finally {
      logger.info("request", {
        status,
        durationMs: Date.now() - ctx.startedAt,
        dbQueries: ctx.dbQueries,
        dbMs: ctx.dbMs,
      });
    }
  });
}

/**
 * Wraps a Route Handler so it reports its own status. Usage:
 *
 *   export const GET = observedRoute("GET /api/products", async (req) => {...});
 *
 * Next.js accepts a `const` export for HTTP verbs, so this needs no change at
 * the call sites beyond the declaration line.
 */
export function observedRoute<A extends unknown[]>(
  route: string,
  handler: (...args: A) => Promise<Response>,
): (...args: A) => Promise<Response> {
  return (...args: A) =>
    observeRequest(route, () => handler(...args), { statusOf: (res) => res.status });
}
