import type { EngineRule } from "../schema/priceRules";
import {
  addCivilDays,
  civilWeekday,
  compareCivil,
  zonedParts,
  zonedToUtc,
  type CivilDate,
} from "./timezone";

export type Interval = { start: Date; end: Date };

type Schedule = Pick<
  EngineRule,
  | "startsAt"
  | "endsAt"
  | "timezone"
  | "recurrence"
  | "startMinute"
  | "durationMinutes"
  | "weekdays"
  | "monthDay"
>;

/**
 * Every occurrence of a rule that overlaps `[from, to)`, as UTC intervals in
 * chronological order, clipped to `[from, to)`.
 *
 * A recurring occurrence is built from WALL-CLOCK times: "Friday 17:00 for 4
 * hours" is 17:00-21:00 local on every Friday, whichever side of a DST switch
 * that Friday falls on. The series bounds decide which occurrences exist by
 * their START, so the last evening of a series is not cut off at midnight.
 */
export function expandOccurrences(rule: Schedule, from: Date, to: Date): Interval[] {
  if (to <= from) return [];

  if (rule.recurrence === "NONE") {
    if (rule.endsAt === null) return [];
    return clip({ start: rule.startsAt, end: rule.endsAt }, from, to);
  }

  if (rule.startMinute === null || rule.durationMinutes === null) return [];
  const startMinute = rule.startMinute;
  const endMinute = startMinute + rule.durationMinutes;
  const tz = rule.timezone;

  // Walk local calendar days. One day of slack on the left catches an
  // occurrence that began the evening before `from` and is still running.
  const seriesFirst = zonedParts(rule.startsAt.getTime(), tz);
  let day: CivilDate = laterOf(seriesFirst, addCivilDays(zonedParts(from.getTime(), tz), -1));
  const lastDay = zonedParts(to.getTime(), tz);

  const out: Interval[] = [];
  for (; compareCivil(day, lastDay) <= 0; day = addCivilDays(day, 1)) {
    if (!occursOn(rule, day)) continue;
    const start = zonedToUtc(day, startMinute, tz);
    if (start < rule.startsAt) continue;
    if (rule.endsAt !== null && start >= rule.endsAt) break;
    out.push(...clip({ start, end: zonedToUtc(day, endMinute, tz) }, from, to));
  }
  return out;
}

function occursOn(rule: Schedule, day: CivilDate): boolean {
  switch (rule.recurrence) {
    case "DAILY":
      return true;
    case "WEEKLY":
      return rule.weekdays.includes(civilWeekday(day));
    case "MONTHLY":
      // A month without that day (the 31st in April) simply has no occurrence.
      return rule.monthDay === day.day;
    default:
      return false;
  }
}

function clip(i: Interval, from: Date, to: Date): Interval[] {
  const start = i.start > from ? i.start : from;
  const end = i.end < to ? i.end : to;
  return start < end ? [{ start, end }] : [];
}

function laterOf(a: CivilDate, b: CivilDate): CivilDate {
  return compareCivil(a, b) >= 0 ? a : b;
}
