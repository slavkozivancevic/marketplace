import { DEFAULT_LOCALE, isLocale, type Locale } from "./config";

/**
 * Shape stored in the `translations` JSON column for any model with
 * translatable string fields. Keys are locale codes; values are partial maps
 * of `field name → translated string`.
 *
 * Only **non-default** locales appear here — the default locale uses the
 * canonical column on the model (e.g. `Product.title`).
 */
export type FieldTranslations<F extends string> = Partial<
  Record<Locale, Partial<Record<F, string>>>
>;

/**
 * Returns the locale's translation for `field`, or `null` when:
 * - locale is the default (caller falls back to canonical),
 * - locale is unsupported,
 * - the translation is missing or whitespace-only.
 */
export function pickTranslatedField<F extends string>(
  translations: FieldTranslations<F> | null | undefined,
  locale: string,
  field: F,
): string | null {
  if (locale === DEFAULT_LOCALE) return null;
  if (!translations || !isLocale(locale)) return null;
  const localeData = translations[locale];
  const value = localeData?.[field]?.trim();
  return value && value.length > 0 ? value : null;
}
