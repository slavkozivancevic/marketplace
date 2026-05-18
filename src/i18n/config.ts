/**
 * Central locale configuration. Add a new language here and the rest of the
 * app — message loading, validation, language switcher, translation forms,
 * search text indexing — picks it up automatically.
 *
 * To add a locale: append to `SUPPORTED_LOCALES`, add an entry to
 * `LOCALE_LABELS`, drop a `messages/<locale>.json` file in place.
 */
export const SUPPORTED_LOCALES = ["en", "sr", "de", "es"] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

/**
 * Non-default locales — the ones that need separate translation input on
 * forms and contribute to the search text blob. The default locale uses the
 * canonical fields (Product.title, etc.) directly.
 */
export const NON_DEFAULT_LOCALES = SUPPORTED_LOCALES.filter(
  (l) => l !== DEFAULT_LOCALE,
) as Exclude<Locale, typeof DEFAULT_LOCALE>[];

export const LOCALE_LABELS: Record<
  Locale,
  { label: string; flag: string; emoji: string; bcp47: string }
> = {
  en: { label: "English", flag: "https://flagcdn.com/w40/gb.png", emoji: "🇬🇧", bcp47: "en-US" },
  // Serbian uses Latin script in this app.
  sr: { label: "Srpski", flag: "https://flagcdn.com/w40/rs.png", emoji: "🇷🇸", bcp47: "sr-Latn" },
  de: { label: "Deutsch", flag: "https://flagcdn.com/w40/de.png", emoji: "🇩🇪", bcp47: "de-DE" },
  es: { label: "Español", flag: "https://flagcdn.com/w40/es.png", emoji: "🇪🇸", bcp47: "es-ES" },
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

export function asLocale(value: unknown): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE;
}
