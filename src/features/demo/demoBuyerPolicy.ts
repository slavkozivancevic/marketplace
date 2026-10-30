/**
 * A visitor buyer lives a day: long enough to shop, check out and come back to
 * the order the same evening, short enough that the accounts stay few.
 */
export const DEMO_BUYER_TTL_MS = 24 * 60 * 60 * 1000;
/**
 * At most this many live at once. The Clerk development instance - shared by
 * local and staging - holds 100 users in all, so a burst of visitors retires
 * the oldest buyers early rather than filling it.
 */
export const DEMO_BUYER_LIMIT = 30;
/** Deleted per click, so the click that cleans up stays quick. */
export const DEMO_BUYER_CLEANUP_BATCH = 5;

type BuyerRow = { clerkUserId: string; createdAt: Date };

/**
 * Which visitor buyers to retire before one more is made: every one past the
 * TTL, then the oldest until the new one fits under the limit - at most a
 * batch per call, oldest first. Pure, so the rule is tested without Clerk.
 */
export function pickDemoBuyersToRetire(rows: BuyerRow[], now: Date): string[] {
  const oldestFirst = [...rows].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const expired = oldestFirst.filter((r) => now.getTime() - r.createdAt.getTime() >= DEMO_BUYER_TTL_MS);
  const overLimit = Math.max(0, oldestFirst.length + 1 - DEMO_BUYER_LIMIT);
  const count = Math.min(Math.max(expired.length, overLimit), DEMO_BUYER_CLEANUP_BATCH);
  return oldestFirst.slice(0, count).map((r) => r.clerkUserId);
}
