import "server-only";

/**
 * In-memory fixed-window rate limiter.
 *
 * Deliberately zero-infra ($0-first): a per-process Map, no Redis/Upstash. This
 * is the *application* throttle layer that protects expensive paths (checkout,
 * uploads, search) from accidental floods and casual abuse. It is intentionally
 * a single, swappable abstraction - `checkRateLimit` - so a distributed backend
 * (Upstash/Redis) can replace the store later without touching any call site.
 *
 * Limits are per-instance: under multiple serverless instances each enforces its
 * own window, so effective limits scale with instance count. True
 * network-edge/DDoS protection belongs at CloudFront/WAF on deploy; this guards
 * the origin's hot logic in the meantime.
 */

type Bucket = { count: number; resetAt: number };

// Module-level so it survives across requests on a warm instance.
const store = new Map<string, Bucket>();

const SWEEP_INTERVAL_MS = 60_000;
let lastSweep = Date.now();

/** Drops expired buckets occasionally so the Map can't grow unbounded. */
function sweep(now: number): void {
  if (now - lastSweep < SWEEP_INTERVAL_MS) return;
  lastSweep = now;
  for (const [key, bucket] of store) {
    if (bucket.resetAt <= now) store.delete(key);
  }
}

export type RateLimitResult = {
  success: boolean;
  limit: number;
  remaining: number;
  /** Epoch ms when the current window resets. */
  reset: number;
  /** Seconds until the window resets (0 when the request is allowed). */
  retryAfterSec: number;
};

/**
 * Counts one hit against `key` and reports whether it's within `limit` for the
 * current `windowMs`. The first hit of a window opens it; subsequent hits share
 * its reset time.
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  sweep(now);

  let bucket = store.get(key);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + windowMs };
    store.set(key, bucket);
  }
  bucket.count += 1;

  const success = bucket.count <= limit;
  const remaining = Math.max(0, limit - bucket.count);
  const retryAfterSec = success ? 0 : Math.ceil((bucket.resetAt - now) / 1000);

  return { success, limit, remaining, reset: bucket.resetAt, retryAfterSec };
}

/**
 * Named policies. Tuned to be invisible to real users but to cap automated
 * floods. `windowMs` is the rolling window; `limit` is hits allowed within it.
 */
export const RATE_LIMITS = {
  // Per authenticated user (falls back to IP for guests): starting a payment is
  // never rapid-fire.
  checkout: { limit: 10, windowMs: 60_000 },
  // Per user: the whole media pipeline shares this bucket - presign + process
  // (sharp/ffmpeg) + delete, plus chat attachment presign. A heavy product save
  // fires several calls per image (presign + process), so the limit is high
  // enough for bulk imagery in one burst yet still caps a hammering script.
  upload: { limit: 120, windowMs: 60_000 },
  // Per IP: public catalog search / listing - high so normal browsing/paging is
  // unaffected.
  search: { limit: 90, windowMs: 60_000 },
  // Per visitor (IP): engagement beacons (view / add-to-cart) fire often.
  interaction: { limit: 150, windowMs: 60_000 },
  // Per user: writing reviews is deliberate, low volume.
  review: { limit: 8, windowMs: 60_000 },
} as const;

export type RateLimitPolicy = keyof typeof RATE_LIMITS;
