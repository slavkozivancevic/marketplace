import "server-only";
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { TooManyRequestsError } from "@/features/common/errors/domainErrors";
import { checkRateLimit, RATE_LIMITS, type RateLimitPolicy } from "./limiter";

/**
 * Best-effort client IP from the standard proxy headers. Behind CloudFront /
 * a load balancer `x-forwarded-for` is the client chain (first entry = origin
 * client). Falls back to a constant so a missing header degrades to a shared
 * bucket rather than throwing.
 */
export async function getClientIp(): Promise<string> {
  const h = await headers();
  const xff = h.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return h.get("x-real-ip") ?? "unknown";
}

/**
 * Server-action guard: throws {@link TooManyRequestsError} (surfaced as a
 * localized toast via handleActionError) when `identifier` exceeds `policy`.
 * `identifier` should be the user id when authenticated, else the client IP.
 */
export async function enforceRateLimit(
  policy: RateLimitPolicy,
  identifier: string,
): Promise<void> {
  const { limit, windowMs } = RATE_LIMITS[policy];
  const res = checkRateLimit(`${policy}:${identifier}`, limit, windowMs);
  if (!res.success) {
    throw new TooManyRequestsError({
      key: "tooManyRequests",
      params: { seconds: res.retryAfterSec },
    });
  }
}

/**
 * Route-handler guard: returns a `429` response (with `Retry-After` +
 * `RateLimit-*` headers) when `identifier` exceeds `policy`, or `null` to
 * proceed. Usage: `const limited = await rateLimitResponse(...); if (limited) return limited;`
 */
export async function rateLimitResponse(
  policy: RateLimitPolicy,
  identifier: string,
): Promise<NextResponse | null> {
  const { limit, windowMs } = RATE_LIMITS[policy];
  const res = checkRateLimit(`${policy}:${identifier}`, limit, windowMs);
  if (res.success) return null;

  return NextResponse.json(
    { error: true, message: "Too many requests" },
    {
      status: 429,
      headers: {
        "Retry-After": String(res.retryAfterSec),
        "RateLimit-Limit": String(res.limit),
        "RateLimit-Remaining": String(res.remaining),
        "RateLimit-Reset": String(Math.ceil(res.reset / 1000)),
      },
    },
  );
}
