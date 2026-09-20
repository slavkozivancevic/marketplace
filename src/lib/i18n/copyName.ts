import { DEFAULT_LOCALE, type Locale } from "@/i18n/config";

/**
 * Localized "Copy of X" naming for duplicate actions (brands, categories,
 * tags, attributes, products). Each translation row carries its own locale, so
 * the prefix must match THAT row's language - a Serbian admin list showing
 * "Copy of Patike" reads like a bug.
 *
 * A static map (not messages/*.json) on purpose: this runs in the db layer,
 * where no request-locale/intl context exists, and per-row locales differ
 * within a single duplicate call anyway.
 */
const COPY_PREFIX_BY_LOCALE: Record<Locale, string> = {
  en: "Copy of ",
  sr: "Kopija od ",
  de: "Kopie von ",
  es: "Copia de ",
};

/**
 * Prefixes `name` with its locale's "Copy of".
 *
 * The prefix stacks on purpose - duplicating a duplicate reads "Copy of Copy of
 * X", the way a file manager names copies, so the list shows how deep a copy
 * is. Unlike an identifier, a name has no uniqueness to protect.
 *
 * `maxLength` is the form's own limit for the field, and must be passed
 * wherever the schema has one. A duplicate is written straight to the DB (no
 * column length, no Zod), so a copy that outgrew the form would exist as a row
 * that the edit form then refuses to save. The NAME is what gets clipped, never
 * the prefix - a copy named "Kopija o" would lose the one word that says what
 * it is.
 */
export function copyName(locale: string, name: string, maxLength?: number): string {
  const prefix =
    COPY_PREFIX_BY_LOCALE[locale as Locale] ?? COPY_PREFIX_BY_LOCALE[DEFAULT_LOCALE];
  const full = `${prefix}${name}`;
  if (maxLength == null || full.length <= maxLength) return full;

  const room = maxLength - prefix.length;
  // Pathological limit, shorter than the prefix itself: keep it valid and move
  // on rather than returning something longer than the caller allows.
  if (room <= 0) return full.slice(0, Math.max(0, maxLength));
  return `${prefix}${name.slice(0, room).trimEnd()}`;
}
