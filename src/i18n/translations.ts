import { DEFAULT_LOCALE, isLocale, type Locale } from "./config";

/**
 * Shape stored in the legacy `translations` JSON column - retained as the
 * input shape for create/update operations. Forms still emit data in this
 * format; repositories translate it into rows on the per-entity translation
 * tables (`BrandTranslation`, `CategoryTranslation`, `ProductTranslation`,
 * `VariantOptionTranslation`).
 *
 * Only **non-default** locales appear here - the default locale's values
 * are carried by the canonical `name` / `title` / `slug` / `description`
 * fields on the same input.
 */
export type FieldTranslations<F extends string> = Partial<
  Record<Locale, Partial<Record<F, string>>>
>;

/**
 * Generic shape of a translation row stored in any `{Entity}Translation`
 * table. The minimum guarantee is a `locale`; field names are entity-specific
 * (e.g. `name` on BrandTranslation, `title` on ProductTranslation).
 */
export type LocalizedRow = { locale: string };

/**
 * Picks the translation row matching `locale`, falling back to the default
 * locale's row if none matches. Returns `undefined` only when the relation
 * is empty (which should not happen for any entity created through the
 * repository layer - every entity must have at least the default-locale row).
 */
export function pickTranslation<T extends LocalizedRow>(
  rows: readonly T[] | null | undefined,
  locale: string,
): T | undefined {
  if (!rows || rows.length === 0) return undefined;
  return (
    rows.find((r) => r.locale === locale) ??
    rows.find((r) => r.locale === DEFAULT_LOCALE) ??
    rows[0]
  );
}

/**
 * Resolves a **display** string (title / name / label) for `locale`, walking
 * locale → default locale → any remaining row and taking the first NON-BLANK
 * value.
 *
 * The blank check is the whole point, and it is why callers must not hand-roll
 * `rows.find((r) => r.locale === locale)?.title ?? englishTitle`. A row can
 * exist for a locale while its display field is empty: the row is kept alive
 * by its slug (`@@unique([locale, slug])` forbids a blank one) or by a
 * translated description, and the name/title is stored exactly as typed -
 * possibly "" - so the admin edit form can show that field as genuinely empty
 * rather than silently pre-filled with the English text. `??` only fires on
 * null/undefined, so it stops at that empty string and the UI renders a blank
 * heading, breadcrumb, invoice line or page title instead of falling back.
 */
export function pickTranslatedText<T extends LocalizedRow>(
  rows: readonly T[] | null | undefined,
  locale: string,
  field: keyof T,
): string {
  if (!rows || rows.length === 0) return "";
  const read = (row: T | undefined): string => {
    const value = row?.[field];
    return typeof value === "string" ? value.trim() : "";
  };
  return (
    read(rows.find((r) => r.locale === locale)) ||
    read(rows.find((r) => r.locale === DEFAULT_LOCALE)) ||
    read(rows.find((r) => read(r).length > 0)) ||
    ""
  );
}

/**
 * Resolves the value of `field` for the given locale, falling back through
 * locale → default locale → null. Returns `null` (not undefined) when the
 * field is missing or whitespace-only, mirroring the legacy helper contract.
 */
export function pickTranslatedField<F extends string>(
  rows: readonly ({ locale: string } & Partial<Record<F, string | null>>)[] | null | undefined,
  locale: string,
  field: F,
): string | null {
  if (!rows || rows.length === 0) return null;
  const target = isLocale(locale) ? locale : DEFAULT_LOCALE;
  const match =
    rows.find((r) => r.locale === target) ??
    rows.find((r) => r.locale === DEFAULT_LOCALE);
  const value = match?.[field];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}