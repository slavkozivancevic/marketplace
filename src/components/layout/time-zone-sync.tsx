"use client";

import { useEffect } from "react";
import { TIME_ZONE_COOKIE, TIME_ZONE_COOKIE_MAX_AGE } from "@/lib/i18n/timeZone";

// Module-level so the React Compiler doesn't flag the document.cookie write
// as mutating a global from inside the component (same as MarketProvider).
function persistTimeZone(zone: string) {
  document.cookie = `${TIME_ZONE_COOKIE}=${encodeURIComponent(zone)}; path=/; max-age=${TIME_ZONE_COOKIE_MAX_AGE}; SameSite=Lax`;
}

/**
 * Tells the server which time zone this browser is in (see lib/i18n/timeZone),
 * so a timestamp rendered on the server reads the same as one rendered here.
 * Writes only when it changed - a laptop that travelled, or the first visit.
 */
export function TimeZoneSync() {
  useEffect(() => {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!zone) return;
    const current = document.cookie
      .split("; ")
      .find((c) => c.startsWith(`${TIME_ZONE_COOKIE}=`))
      ?.slice(TIME_ZONE_COOKIE.length + 1);
    if (current && decodeURIComponent(current) === zone) return;
    persistTimeZone(zone);
  }, []);

  return null;
}
