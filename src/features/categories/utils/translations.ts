import {
  pickTranslation,
  pickTranslatedText,
  type FieldTranslations,
} from "@/i18n/translations";

/** Input shape used by forms - per-locale name/slug/description for non-default locales. */
export type CategoryTranslations = FieldTranslations<"name" | "slug" | "description">;

// Each helper accepts the minimum projection it actually reads so callers can
// pass slim selects (e.g. just `{ locale, name }`) without satisfying every
// optional field on the underlying CategoryTranslation row.
type WithName = { locale: string; name: string };
type WithSlug = { locale: string; slug: string };
type WithDescription = { locale: string; description: string | null };

/**
 * Returns the localized name, falling back to the default-locale row -
 * including when this locale HAS a translation row (kept alive by a
 * translated description) but its own name was left blank, not just when
 * the row is missing outright. Storing name blank there (rather than a copy
 * of the default-locale name) is what lets the admin edit form show that
 * field as genuinely empty instead of silently pre-filled.
 *
 * Always resolve category names through this - a hand-rolled
 * `translations.find((t) => t.locale === locale)?.name ?? englishName`
 * returns the blank name rather than falling back, because `??` does not
 * fire on "".
 */
export function getCategoryName(
  category: { translations: readonly WithName[] },
  locale: string,
): string {
  return pickTranslatedText(category.translations, locale, "name");
}

/** Returns the localized slug, falling back to the default-locale row. */
export function getCategorySlug(
  category: { translations: readonly WithSlug[] },
  locale: string,
): string {
  return pickTranslation(category.translations, locale)?.slug ?? "";
}

/** Returns the localized description, falling back to the default-locale row. */
export function getCategoryDescription(
  category: { translations: readonly WithDescription[] },
  locale: string,
): string | null {
  return pickTranslation(category.translations, locale)?.description ?? null;
}
