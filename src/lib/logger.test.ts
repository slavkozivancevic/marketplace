import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * The JSON record shape is a production interface: CloudWatch metric filters
 * extract metric values from these exact field names (ROADMAP #23). A rename
 * would not fail a build - it would silently flatline a dashboard - so the
 * shape is pinned here instead.
 *
 * `LOG_JSON` is read at module scope, hence the reset-and-reimport per test.
 */
async function loadLogger() {
  vi.resetModules();
  vi.stubEnv("LOG_JSON", "1");
  return import("./logger");
}

function captureLine(spy: ReturnType<typeof vi.spyOn>): Record<string, unknown> {
  expect(spy).toHaveBeenCalledTimes(1);
  return JSON.parse(spy.mock.calls[0][0] as string);
}

describe("logger JSON records", () => {
  let log: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    log = vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("flattens a field bag to top-level keys (metric filters need this)", async () => {
    const { logger } = await loadLogger();

    logger.info("request", { route: "POST /checkout", status: 200, durationMs: 412 });

    expect(captureLine(log)).toMatchObject({
      level: "info",
      msg: "request",
      route: "POST /checkout",
      status: 200,
      durationMs: 412,
    });
  });

  it("never lets caller fields overwrite the envelope", async () => {
    const { logger } = await loadLogger();

    logger.info("real message", { msg: "spoofed", level: "error", route: "/x" });

    const record = captureLine(log);
    expect(record.msg).toBe("real message");
    expect(record.level).toBe("info");
    expect(record.route).toBe("/x");
  });

  it("expands Errors inside a field bag (they do not survive stringify)", async () => {
    const { logger } = await loadLogger();

    logger.info("failed", { cause: new TypeError("boom") });

    const record = captureLine(log);
    expect(record.cause).toMatchObject({ name: "TypeError", message: "boom" });
  });

  it("falls back to `details` for shapes it cannot flatten", async () => {
    const { logger } = await loadLogger();

    logger.info("multi", { a: 1 }, "second arg");

    expect(captureLine(log)).toMatchObject({ msg: "multi", details: [{ a: 1 }, "second arg"] });
  });

  it("merges the registered context provider into every record", async () => {
    const { logger, setLogContextProvider } = await loadLogger();
    setLogContextProvider(() => ({ requestId: "abc123", route: "GET /products" }));

    logger.info("request", { status: 200 });

    expect(captureLine(log)).toMatchObject({
      requestId: "abc123",
      route: "GET /products",
      status: 200,
    });
  });

  it("keeps a class instance out of the flat namespace", async () => {
    const { logger } = await loadLogger();
    class Payload {
      constructor(readonly secret = "x") {}
    }

    logger.info("odd", new Payload());

    const record = captureLine(log);
    expect(record.secret).toBeUndefined();
    expect(record.details).toEqual([{ secret: "x" }]);
  });
});
