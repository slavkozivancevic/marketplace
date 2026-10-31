import { cookies } from "next/headers";
import { TIME_ZONE_COOKIE, validTimeZone } from "./timeZone";

/**
 * The zone to format server-rendered timestamps in: the browser's, from its
 * cookie. UTC only for a first visit that opens such a page directly, before
 * any page has written the cookie.
 */
export async function getViewerTimeZone(): Promise<string> {
  const store = await cookies();
  return validTimeZone(store.get(TIME_ZONE_COOKIE)?.value) ?? "UTC";
}
