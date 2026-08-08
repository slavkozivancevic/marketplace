import { pickTranslation, type FieldTranslations } from "@/i18n/translations";

/** Input shape used by forms - per-locale name/slug for non-default locales. */
export type TagTranslations = FieldTranslations<"name" | "slug">;

type WithName = { locale: string; name: string };
type WithSlug = { locale: string; slug: string };

/** Returns the localized name, falling back to the default-locale row. */
export function getTagName(
  tag: { translations: readonly WithName[] },
  locale: string,
): string {
  return pickTranslation(tag.translations, locale)?.name ?? "";
}

/** Returns the localized slug, falling back to the default-locale row. */
export function getTagSlug(
  tag: { translations: readonly WithSlug[] },
  locale: string,
): string {
  return pickTranslation(tag.translations, locale)?.slug ?? "";
}
