import type { ComponentProps } from "react";
import type { ClerkProvider } from "@clerk/nextjs";
import { deDE, enUS, esES, srRS } from "@clerk/localizations";
import type { Locale } from "@/i18n/config";
import { DE_STRINGS } from "./de";
import { ES_STRINGS } from "./es";
import { SR_STRINGS } from "./sr";

type ClerkLocalization = NonNullable<ComponentProps<typeof ClerkProvider>["localization"]>;

/**
 * Lays flat dotted-path strings over one of Clerk's localizations without
 * mutating it: each path's parents are copied on the way down, so siblings the
 * overrides do not name keep Clerk's own text.
 */
export function withStrings(base: ClerkLocalization, strings: Record<string, string>): ClerkLocalization {
  const result: Record<string, unknown> = { ...base };
  for (const [path, value] of Object.entries(strings)) {
    const keys = path.split(".");
    let node = result;
    for (const key of keys.slice(0, -1)) {
      const next = node[key];
      node[key] = typeof next === "object" && next !== null ? { ...next } : {};
      node = node[key] as Record<string, unknown>;
    }
    node[keys[keys.length - 1]] = value;
  }
  return result as ClerkLocalization;
}

/**
 * Clerk's own copy (sign-in, sign-up, the user menu and profile,
 * organizations) in the page's language, addressing the user the way the site
 * does: "Vi" in Serbian, "Sie" in German, "tú" in Spanish. A `Record` over
 * `Locale`, so a new language without its Clerk strings fails to compile
 * instead of quietly falling back to English.
 */
export const CLERK_LOCALIZATIONS: Record<Locale, ClerkLocalization> = {
  en: enUS,
  sr: withStrings(srRS, SR_STRINGS),
  de: withStrings(deDE, DE_STRINGS),
  es: withStrings(esES, ES_STRINGS),
};
