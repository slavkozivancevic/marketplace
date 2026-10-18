/**
 * The return deadline, in one place.
 *
 * Both the server guard in `createReturn` and the buyer's return button read
 * this. That is the whole point: a policy the buyer is shown but the server
 * computes differently is worse than no policy at all - the buyer fills in a
 * form that was always going to be refused.
 *
 * The clock starts at DELIVERY, not at the order date. A seller who ships late
 * must not eat into the buyer's window, and a part that was never delivered has
 * no window at all (that case is caught before this, by the delivered check).
 */

/** Milliseconds in a day. Calendar days, not working days - unlike the delivery
 *  estimate, this is a consumer-facing deadline and every day counts. */
const DAY_MS = 24 * 60 * 60 * 1000;

/** Mirrors `Organization.returnWindowDays`'s column default, for the one read
 *  path that has to survive a missing org row (the product page's structured
 *  data). Not a fallback for ordinary reads - the column is NOT NULL, so every
 *  live seller has a real value and nothing else should be guessing one. */
export const DEFAULT_RETURN_WINDOW_DAYS = 14;

/**
 * Last moment a return can still be opened.
 *
 * Deliberately `deliveredAt + windowDays`, to the millisecond, rather than
 * end-of-day in some timezone: the app stores UTC timestamps and has no notion
 * of the buyer's local midnight, so "end of the 14th day" would have to pick a
 * zone, and whichever it picked would be wrong for someone. A window of 0 days
 * yields the delivery instant itself, which no later request can be within -
 * exactly what "we do not accept returns" means.
 */
export function returnDeadline(deliveredAt: Date, windowDays: number): Date {
  return new Date(deliveredAt.getTime() + windowDays * DAY_MS);
}

/** Whether a return opened at `now` is still inside the seller's window. */
export function isWithinReturnWindow(
  deliveredAt: Date,
  windowDays: number,
  now: Date = new Date(),
): boolean {
  return now.getTime() <= returnDeadline(deliveredAt, windowDays).getTime();
}

/**
 * Whole days left before the deadline, rounded UP, so a deadline 30 minutes
 * away reads as "1 day left" rather than "0 days left" next to a button that
 * still works. Never negative: past the deadline this is 0 and the caller shows
 * the expired message instead.
 */
export function returnDaysLeft(
  deliveredAt: Date,
  windowDays: number,
  now: Date = new Date(),
): number {
  const remaining = returnDeadline(deliveredAt, windowDays).getTime() - now.getTime();
  return remaining <= 0 ? 0 : Math.ceil(remaining / DAY_MS);
}
