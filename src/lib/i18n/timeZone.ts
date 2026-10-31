/**
 * The viewer's time zone, for timestamps rendered on the server.
 *
 * A client component formats a date in the browser's own zone; a server
 * component runs on Lambda, which is UTC, so the same order read 08:29 in the
 * list and 07:29 on its detail page (and near midnight the date itself would
 * be a day off). The browser writes its zone to this cookie (TimeZoneSync) and
 * the server formats with it - the way NEXT_COUNTRY carries the country.
 */
export const TIME_ZONE_COOKIE = "NEXT_TZ";
export const TIME_ZONE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** An IANA zone the runtime understands, or null - the cookie is client input. */
export function validTimeZone(value: string | null | undefined): string | null {
  if (!value || value.length > 64) return null;
  try {
    new Intl.DateTimeFormat("en", { timeZone: value });
    return value;
  } catch {
    return null;
  }
}
