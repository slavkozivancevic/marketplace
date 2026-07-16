import { DEFAULT_LOCALE, type Locale } from "@/i18n/config";

/**
 * Localized "Copy of X" naming for duplicate actions (brands, categories,
 * products). Each translation row carries its own locale, so the prefix must
 * match THAT row's language - a Serbian admin list showing "Copy of Patike"
 * reads like a bug.
 *
 * A static map (not messages/*.json) on purpose: this runs in the db layer,
 * where no request-locale/intl context exists, and per-row locales differ
 * within a single duplicate call anyway.
 */
const COPY_NAME_BY_LOCALE: Record<Locale, (name: string) => string> = {
  en: (name) => `Copy of ${name}`,
  sr: (name) => `Kopija od ${name}`,
  de: (name) => `Kopie von ${name}`,
  es: (name) => `Copia de ${name}`,
};

export function copyName(locale: string, name: string): string {
  const format =
    COPY_NAME_BY_LOCALE[locale as Locale] ?? COPY_NAME_BY_LOCALE[DEFAULT_LOCALE];
  return format(name);
}
