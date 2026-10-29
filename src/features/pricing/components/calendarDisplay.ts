// `sr` alone makes Intl write Cyrillic; the app is Latin (sr-Latn).
import { dateLocale } from "@/lib/i18n/dateLocale";
import { calendarPeriods, sameSchedule, type CalendarPeriod, type CalendarRow } from "../engine/calendar";

/**
 * What the price calendar draws, shared by `PriceCalendar` and its skeleton so
 * the two can never disagree on rows, periods or sizes.
 */

/** Grid geometry - one source for the calendar and its skeleton. */
export const CAL = {
  /** Row label column. */
  label: "w-44 shrink-0",
  /** One day. */
  cell: "size-5 shrink-0 rounded-sm",
  /** Between days. */
  gap: "gap-0.5",
  /** The two header lines (month, day number). */
  headLine: "h-4",
} as const;

/**
 * "Normal price": a muted fill with an inset outline, so the square stays
 * visible on every theme - a bare `bg-muted` sank into the panel behind it.
 * Inset, so it takes no room and a coloured day lines up with a plain one.
 */
export const BASE_SWATCH = "bg-muted ring-1 ring-inset ring-foreground/20";

export type DisplayRow = { key: string; label: string; row: CalendarRow };

/**
 * The rows worth drawing. When the product and every variant are priced the
 * same way every day - a rule on the whole product, the usual case - one row
 * says it all instead of N identical ones.
 */
export function displayRows(
  rows: readonly CalendarRow[],
  rowLabels: Record<string, string>,
  allVariantsLabel: string,
): DisplayRow[] {
  if (rows.length > 1 && rows.every((r) => sameSchedule(r, rows[0]))) {
    return [{ key: "all", label: allVariantsLabel, row: rows[0] }];
  }
  return rows.map((r) => ({ key: r.variantId ?? "", label: rowLabels[r.variantId ?? ""] ?? "", row: r }));
}

/** A calendar date ("2026-11-27") as a UTC midnight, so formatting never shifts it a day. */
const asDate = (iso: string) => new Date(`${iso}T00:00:00Z`);

export function dayOfMonth(iso: string): number {
  return asDate(iso).getUTCDate();
}

export function isWeekend(iso: string): boolean {
  const d = asDate(iso).getUTCDay();
  return d === 0 || d === 6;
}

export function monthName(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(dateLocale(locale), { month: "short", timeZone: "UTC" }).format(asDate(iso));
}

export function shortDate(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(dateLocale(locale), { day: "numeric", month: "short", timeZone: "UTC" }).format(asDate(iso));
}

export function longDate(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(dateLocale(locale), { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(
    asDate(iso),
  );
}

type RangeCopy = { today: string; everyDay: string; from: (date: string) => string };

/**
 * A period in words: "Today - 9 Nov", "27 Nov - 30 Nov", "From 1 Dec". The
 * calendar ends where its 60 days end, not where the price does, so the last
 * period is open-ended rather than claiming a made-up end date.
 */
export function periodRange(
  period: CalendarPeriod,
  firstDay: string,
  lastDay: string,
  locale: string,
  copy: RangeCopy,
): string {
  const start = period.from === firstDay ? copy.today : shortDate(period.from, locale);
  if (period.to === lastDay) return period.from === firstDay ? copy.everyDay : copy.from(start);
  if (period.from === period.to) return start;
  return `${start} - ${shortDate(period.to, locale)}`;
}

export { calendarPeriods };
