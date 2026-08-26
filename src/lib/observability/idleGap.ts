/**
 * Tells a genuinely slow query apart from one that merely paid for waking
 * something up.
 *
 * WHY THIS EXISTS. Neon's Free plan suspends the compute after 5 minutes of
 * inactivity and the timeout is not configurable; keeping it awake would burn
 * the 100 CU-hour monthly allowance and suspend the database for the rest of
 * the month, so scale-to-zero is a fixed property of this environment rather
 * than a setting we forgot. The first query after a suspension waits seconds
 * for the compute to resume, and Prisma's timer bills that entire wait to
 * whichever query happened to be first.
 *
 * The result, measured on staging: `ProductTranslation.findUnique` reported a
 * *minimum* of 796ms and `Brand.findMany` peaked at 3.3s - neither of which a
 * database can actually take for an indexed lookup over a small table. Left
 * alone, the slow-query signal reports "this request woke the database" rather
 * than "this query is inefficient", which is the one thing it exists to say.
 *
 * The heuristic is a gap since the previous query, and it is only ever applied
 * to queries that are ALSO over the slow threshold. That conjunction is what
 * makes a crude time-based rule safe: a warm database answers in single-digit
 * milliseconds after any amount of idling, so it never reaches the branch. A
 * query has to be both slow and preceded by silence to be called cold.
 */

/**
 * Neon suspends at 5 minutes. A minute is comfortably inside that, so a warm
 * connection is never mislabelled, while every real suspension is caught.
 */
export const COLD_GAP_MS = 60_000;

/**
 * A resume is not one slow query, it is a slow few seconds.
 *
 * Measured on staging, every single cluster looked like this - one query
 * carrying the resume, then a tail of queries still paying for connections and
 * caches that had not settled yet:
 *
 *   23:56:36  COLD  3150ms  Category.findMany
 *   23:56:36        203ms   Product.findMany
 *   23:56:36        204ms   Product.findMany
 *   23:56:36        205ms   Product.findMany
 *   ...77 minutes of silence...
 *
 * The same `Product.findMany` runs in 12-20ms once warm, so the tail is not a
 * property of the query. Tagging only the first one left the rest looking like
 * genuine slow queries, which is the exact confusion this module exists to
 * remove. Ten seconds covers every cluster observed (the longest ran nine).
 */
export const COLD_TAIL_MS = 10_000;

/**
 * Still inside the warm-up wake left behind by a recent resume?
 *
 * Kept separate from the gap rule because they answer different questions:
 * the gap asks "was anything asleep before this query", the tail asks "are we
 * still recovering from something that was".
 */
export function isWithinColdTail(coldUntil: number, now: number): boolean {
  return now < coldUntil;
}

export function isAfterIdleGap(
  lastQueryEndedAt: number | undefined,
  now: number,
  gapMs: number = COLD_GAP_MS,
): boolean {
  // No previous query means a fresh Lambda container: cold by definition.
  if (lastQueryEndedAt === undefined) return true;
  return now - lastQueryEndedAt > gapMs;
}