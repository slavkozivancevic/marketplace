/**
 * Minimal structured logger ($0, zero-dep). A drop-in for `console` (variadic
 * args) that in production emits single-line JSON for log aggregators
 * (CloudWatch, etc.) and in dev prints a readable line. Isomorphic - safe on
 * server and client (uses only `console`, `Date`, and the inlined `NODE_ENV`).
 *
 * FIELDS ARE FLAT ON PURPOSE. `logger.info("msg", { route, durationMs })` emits
 * `{"level":"info","msg":"msg","route":"...","durationMs":12}` rather than
 * nesting under `details`. CloudWatch Logs Insights can only `filter` / `stats`
 * on addressable fields, and metric filters can only extract a metric value
 * from one - a value buried in an array is invisible to both. Our custom
 * CloudWatch metrics are produced by metric filters over these very lines (see
 * ROADMAP #23), so the shape of this object is a production interface: renaming
 * a field silently breaks the metric that reads it.
 *
 * Error-level records are the seam for an external tracker (e.g. Sentry): wire
 * it once inside `emit` and every `logger.error(...)` / `captureError(...)` in
 * the app forwards automatically, with no further call-site changes.
 */

type LogLevel = "debug" | "info" | "warn" | "error";

const isProd = process.env.NODE_ENV === "production";
// Escape hatch for exercising the production log shape locally (e.g. when
// checking that a metric-filter pattern actually matches).
const forceJson = process.env.LOG_JSON === "1";
const asJson = isProd || forceJson;

/** Keys the envelope owns; caller-supplied fields never overwrite them. */
const RESERVED = new Set(["level", "time", "msg"]);

type LogFields = Record<string, unknown>;

/**
 * Ambient fields merged into every record - `requestId` and friends. Registered
 * at server startup rather than imported, because the implementation is backed
 * by `AsyncLocalStorage` (Node-only) while this module also runs in the browser
 * bundle. See `src/lib/observability/requestContext.ts`.
 */
type ContextProvider = () => LogFields | undefined;
let contextProvider: ContextProvider | undefined;

export function setLogContextProvider(provider: ContextProvider): void {
  contextProvider = provider;
}

function consoleFor(level: LogLevel): (...args: unknown[]) => void {
  if (level === "error") return console.error;
  if (level === "warn") return console.warn;
  return console.log;
}

/** Errors don't survive JSON.stringify - expand them to a plain object. */
function serialize(value: unknown): unknown {
  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: value.stack };
  }
  return value;
}

/** A caller-supplied field bag: a plain object, not an Error/Array/class. */
function isFieldBag(value: unknown): value is LogFields {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    !(value instanceof Error) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

function emit(level: LogLevel, args: unknown[]): void {
  // Debug is dev-only noise; drop it in production.
  if (level === "debug" && isProd) return;

  const write = consoleFor(level);

  if (asJson) {
    const [first, ...rest] = args;
    const msg = typeof first === "string" ? first : "";
    const extras = typeof first === "string" ? rest : args;

    // The common shape - logger.x("msg", { ...fields }) - is flattened. Anything
    // else (multiple args, a bare value) still falls back to `details` so no
    // existing call site loses information.
    const flat: LogFields = {};
    let details: unknown[] | undefined;

    if (extras.length === 1 && isFieldBag(extras[0])) {
      for (const [key, value] of Object.entries(extras[0])) {
        if (!RESERVED.has(key)) flat[key] = serialize(value);
      }
    } else if (extras.length > 0) {
      details = extras.map(serialize);
    }

    write(
      JSON.stringify({
        ...contextProvider?.(),
        ...flat,
        ...(details ? { details } : {}),
        level,
        time: new Date().toISOString(),
        msg,
      }),
    );
  } else {
    // Dev: keep console's readable multi-arg output, just tag the level and
    // show the correlation id when there is one.
    const ctx = contextProvider?.();
    const tag = ctx?.requestId ? `[${level.toUpperCase()} ${ctx.requestId}]` : `[${level.toUpperCase()}]`;
    write(tag, ...args);
  }

  // SEAM: forward error-level records to an external tracker when wired, e.g.
  //   if (level === "error") Sentry.captureException(...);
}

export const logger = {
  debug: (...args: unknown[]) => emit("debug", args),
  info: (...args: unknown[]) => emit("info", args),
  warn: (...args: unknown[]) => emit("warn", args),
  error: (...args: unknown[]) => emit("error", args),
};

type LogContext = Record<string, unknown>;

/**
 * Reports an unexpected error with its stack + context. Thin wrapper over
 * `logger.error` used by the central funnels (handleActionError, onRequestError,
 * the root error boundary); both it and any direct `logger.error` flow through
 * the same error-level seam.
 */
export function captureError(error: unknown, context?: LogContext): void {
  const err = error instanceof Error ? error : new Error(String(error));
  logger.error(err.message, { ...context, errorName: err.name, stack: err.stack });
}
