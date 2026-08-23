import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * The single "request" summary line is the source for four CloudWatch metric
 * filters (RequestDurationMs, QueriesPerRequest, Http5xx and the N+1 signal),
 * so its field names and its emit-on-failure behaviour are pinned here.
 *
 * Both modules read env / register globals at import time, hence the
 * reset-and-reimport per test.
 */
async function load() {
  vi.resetModules();
  vi.stubEnv("LOG_JSON", "1");
  const logger = await import("@/lib/logger");
  const ctx = await import("./requestContext");
  return { ...ctx, ...logger };
}

type ConsoleSpy = { mock: { calls: unknown[][] } };

function lines(spy: ConsoleSpy): Record<string, unknown>[] {
  return spy.mock.calls.map((call) => JSON.parse(call[0] as string) as Record<string, unknown>);
}

describe("observeRequest", () => {
  let log: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    log = vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("emits exactly one summary line carrying the metric fields", async () => {
    const { observeRequest } = await load();

    await observeRequest("GET /api/products", async () => "ok");

    const summaries = lines(log).filter((l) => l.msg === "request");
    expect(summaries).toHaveLength(1);
    expect(summaries[0]).toMatchObject({
      route: "GET /api/products",
      status: 200,
      dbQueries: 0,
      dbMs: 0,
    });
    expect(typeof summaries[0].durationMs).toBe("number");
    expect(typeof summaries[0].requestId).toBe("string");
  });

  it("still summarises when the handler throws, and rethrows", async () => {
    const { observeRequest } = await load();
    const boom = new Error("boom");

    await expect(
      observeRequest("POST /api/webhooks/stripe", async () => {
        throw boom;
      }),
    ).rejects.toBe(boom);

    const summary = lines(log).find((l) => l.msg === "request");
    expect(summary).toMatchObject({ route: "POST /api/webhooks/stripe", status: 500 });
  });

  it("takes the status from statusOf when given", async () => {
    const { observeRequest } = await load();

    await observeRequest("action createCodCheckout", async () => ({ error: true }), {
      statusOf: (r) => ("error" in r ? 400 : 200),
    });

    expect(lines(log).find((l) => l.msg === "request")).toMatchObject({ status: 400 });
  });

  it("accumulates the db counters that feed the N+1 signal", async () => {
    const { observeRequest, recordDbQuery } = await load();

    await observeRequest("GET /api/products", async () => {
      recordDbQuery(12);
      recordDbQuery(30);
    });

    expect(lines(log).find((l) => l.msg === "request")).toMatchObject({
      dbQueries: 2,
      dbMs: 42,
    });
  });

  it("stamps every log line inside the request with the same requestId", async () => {
    const { observeRequest, logger } = await load();

    await observeRequest("GET /api/products", async () => {
      logger.info("inner work", { step: 1 });
    });

    const [inner, summary] = lines(log);
    expect(inner).toMatchObject({ msg: "inner work", step: 1, route: "GET /api/products" });
    expect(summary.requestId).toBe(inner.requestId);
  });

  it("is inert outside a request - counters must not leak across invocations", async () => {
    const { recordDbQuery, getRequestContext } = await load();

    expect(getRequestContext()).toBeUndefined();
    expect(() => recordDbQuery(5)).not.toThrow();
  });
});
