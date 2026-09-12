import { NextResponse } from "next/server";

/**
 * Terminates every `/api/*` URL that no real route handler serves.
 *
 * WHY THIS EXISTS. Without it an unmatched API path does not 404 - it falls
 * through to `(i18n)/[locale]/[...rest]`, because `[locale]` is a dynamic
 * segment and happily matches the literal segment "api". The catch-all then
 * renders a page for locale "api", which blows up in the locale layout and was
 * logged as `An error occurred in the Server Components render`. Scanner sweeps
 * for `/api/credentials`, `/api/v1/secrets`, `/api/2.0/mlflow/...` and friends
 * produced a steady trickle of those on staging, each one a Lambda invocation
 * and a possible Neon wake-up.
 *
 * Next resolves more specific segments before a catch-all, so every genuine
 * route under `src/app/api` still wins and only true misses land here.
 *
 * JSON rather than an empty body: callers of an API deserve a parseable answer,
 * and it tells a scanner nothing it did not already know.
 */
function notFound() {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

export const GET = notFound;
export const POST = notFound;
export const PUT = notFound;
export const PATCH = notFound;
export const DELETE = notFound;
export const HEAD = notFound;
export const OPTIONS = notFound;
