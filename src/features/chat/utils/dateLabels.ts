import { differenceInCalendarDays, format } from "date-fns";

export type DayKind = "today" | "yesterday" | "older";

/**
 * Which calendar day a timestamp falls on, relative to `now`.
 *
 * Calendar days, not elapsed hours: 23:50 and 00:10 are "yesterday" and
 * "today" twenty minutes apart, which is how people read a clock. Local zone
 * by definition - the label should match the clock on the viewer's wall, and
 * stored timestamps are UTC.
 *
 * Returns the kind rather than a finished string so the caller can translate
 * it. The chat used to print a hardcoded "Today" / "Yesterday" regardless of
 * locale; keeping the wording out of here is what stops that coming back.
 *
 * `now` is a parameter so tests do not depend on the day they run on.
 */
export function classifyDay(at: Date, now: Date = new Date()): DayKind {
  const days = differenceInCalendarDays(now, at);
  // A timestamp in the future means the two clocks disagree, not a
  // prediction - read it as just now rather than printing a date that has
  // not happened yet.
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  return "older";
}

/** The one date format the chat uses - thread divider, inbox row, last seen. */
export function formatChatDate(at: Date): string {
  return format(at, "dd.MM.yyyy");
}

/** The one clock format the chat uses - message times and inbox rows. */
export function formatChatTime(at: Date): string {
  return format(at, "HH:mm");
}
