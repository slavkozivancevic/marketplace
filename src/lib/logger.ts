/**
 * Minimal structured logger ($0, zero-dep). A drop-in for `console` (variadic
 * args) that in production emits single-line JSON for log aggregators
 * (CloudWatch, etc.) and in dev prints a readable line. Isomorphic - safe on
 * server and client (uses only `console`, `Date`, and the inlined `NODE_ENV`).
 *
 * Error-level records are the seam for an external tracker (e.g. Sentry): wire
 * it once inside `emit` and every `logger.error(...)` / `captureError(...)` in
 * the app forwards automatically, with no further call-site changes.
 */

type LogLevel = "debug" | "info" | "warn" | "error";

const isProd = process.env.NODE_ENV === "production";

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

function emit(level: LogLevel, args: unknown[]): void {
  // Debug is dev-only noise; drop it in production.
  if (level === "debug" && isProd) return;

  const write = consoleFor(level);

  if (isProd) {
    const [first, ...rest] = args;
    const msg = typeof first === "string" ? first : "";
    const extras = (typeof first === "string" ? rest : args).map(serialize);
    write(
      JSON.stringify({
        level,
        time: new Date().toISOString(),
        msg,
        ...(extras.length > 0 ? { details: extras } : {}),
      }),
    );
  } else {
    // Dev: keep console's readable multi-arg output, just tag the level.
    write(`[${level.toUpperCase()}]`, ...args);
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
