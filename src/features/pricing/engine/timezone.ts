/**
 * Wall-clock time in an IANA zone <-> UTC instants, with nothing but `Intl`.
 *
 * A seller who types "18:00" means 18:00 in THEIR zone, and that zone moves its
 * offset twice a year. Storing the naive local time would put every price flip
 * an hour off for half the year, so a rule keeps its local time plus the zone,
 * and every occurrence is converted here, one by one.
 *
 * DST edges follow the same rule as Temporal's "compatible" disambiguation:
 * - a wall time that happens twice (autumn, 02:30 exists before and after the
 *   clocks go back) resolves to the EARLIER instant;
 * - a wall time that never happens (spring, 02:30 is skipped) moves FORWARD by
 *   the length of the gap, so 02:30 becomes 03:30.
 */

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let f = formatterCache.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    formatterCache.set(timeZone, f);
  }
  return f;
}

/** True when the runtime knows this IANA zone name. */
export function isValidTimeZone(timeZone: string): boolean {
  if (!timeZone) return false;
  try {
    formatterFor(timeZone);
    return true;
  } catch {
    return false;
  }
}

/** A calendar date with no zone attached, month 1-12. */
export type CivilDate = { year: number; month: number; day: number };

/** The wall clock an instant shows in a zone. `weekday` is ISO: 1 = Monday. */
export type ZonedParts = CivilDate & { minuteOfDay: number; weekday: number };

export function zonedParts(utcMs: number, timeZone: string): ZonedParts {
  const parts = formatterFor(timeZone).formatToParts(new Date(utcMs));
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value);
  const date = { year: get("year"), month: get("month"), day: get("day") };
  return {
    ...date,
    minuteOfDay: get("hour") * 60 + get("minute"),
    weekday: civilWeekday(date),
  };
}

/** Milliseconds the zone is ahead of UTC at this instant. */
function offsetAt(utcMs: number, timeZone: string): number {
  const p = zonedParts(utcMs, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, 0, p.minuteOfDay);
  // Seconds are dropped on both sides, so compare at whole-minute precision.
  return asUtc - Math.floor(utcMs / 60_000) * 60_000;
}

/**
 * The UTC instant at which the zone's wall clock shows `minuteOfDay` on the
 * given date. `minuteOfDay` may exceed 1440; it rolls into the following days,
 * which is how an occurrence's end ("21:00", or "02:00 the next day") is built.
 */
export function zonedToUtc(date: CivilDate, minuteOfDay: number, timeZone: string): Date {
  const local = Date.UTC(date.year, date.month - 1, date.day, 0, minuteOfDay);
  // Offsets either side of any transition near this wall time. Real zones
  // never change their offset twice within 12 hours.
  const before = offsetAt(local - 12 * 3_600_000, timeZone);
  const after = offsetAt(local + 12 * 3_600_000, timeZone);
  const early = local - before;
  const late = local - after;
  const shows = (utc: number) => utc + offsetAt(utc, timeZone) === local;

  if (shows(early)) return new Date(early);
  if (shows(late)) return new Date(late);
  // The wall time falls in a spring-forward gap: read it with the offset that
  // applied before the gap, which lands the same distance past the gap's end.
  return new Date(early);
}

/** ISO weekday of a civil date, 1 = Monday ... 7 = Sunday. */
export function civilWeekday(date: CivilDate): number {
  const d = new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay();
  return d === 0 ? 7 : d;
}

/** `date` plus `days` calendar days. */
export function addCivilDays(date: CivilDate, days: number): CivilDate {
  const d = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

/** Negative, zero or positive, like a sort comparator. */
export function compareCivil(a: CivilDate, b: CivilDate): number {
  return a.year - b.year || a.month - b.month || a.day - b.day;
}

/** Parses "YYYY-MM-DD"; null when the shape or the date itself is wrong. */
export function parseCivilDate(value: string): CivilDate | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  const date = { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
  // 2026-02-31 would silently roll into March; refuse it instead.
  const back = addCivilDays(date, 0);
  return compareCivil(back, date) === 0 ? date : null;
}

/** Parses "HH:mm" into minutes since midnight; null when invalid. */
export function parseMinuteOfDay(value: string): number | null {
  const m = /^(\d{2}):(\d{2})$/.exec(value);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h < 24 && min < 60 ? h * 60 + min : null;
}
