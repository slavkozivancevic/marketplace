import { pickTranslation } from "@/i18n/translations";
import type { Locale } from "@/i18n/config";

/**
 * Form input shape - per locale, the option may carry a translated `name`
 * and a `values` record mapping the canonical option value to its
 * translation (e.g. `{ "Red": "Crvena" }`).
 */
export type OptionTranslations = Partial<
  Record<Locale, { name?: string; values?: Record<string, string> }>
>;

// Prisma types the `values` JSON column as `JsonValue` (which is a union that
// includes scalars and arrays), but at runtime we only ever write an object
// of `{ [originalValue]: translatedValue }`. The helper accepts the wider
// Prisma type so callers don't need to cast. Each helper also accepts only
// the minimum projection it actually reads so callers can pass slim selects.
type WithName = { locale: string; name: string };
type WithValues = { locale: string; values: unknown };

function asValuesMap(v: unknown): Record<string, string> | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  return v as Record<string, string>;
}

/** Returns the localized option name, falling back to the default-locale row. */
export function getOptionName(
  option: { translations: readonly WithName[] },
  locale: string,
): string {
  return pickTranslation(option.translations, locale)?.name ?? "";
}

/**
 * Returns the localized option value, falling back to the original value
 * when no translation exists.
 */
export function getOptionValue(
  option: { translations: readonly WithValues[] },
  value: string,
  locale: string,
): string {
  const row = pickTranslation(option.translations, locale);
  const values = asValuesMap(row?.values);
  const translated = values?.[value]?.trim();
  return translated && translated.length > 0 ? translated : value;
}
