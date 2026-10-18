import { DEFAULT_LOCALE } from "@/i18n/config";

export type TrustPointTranslationRow = {
  locale: string;
  label: string;
  sublabel: string | null;
};

type Translatable = { translations: readonly TrustPointTranslationRow[] };

/**
 * The label in the reader's language, falling back to the default locale and
 * then to whatever row exists.
 *
 * A locale CAN have a row whose label was left blank (kept alive by its
 * sublabel), so this checks for content rather than for the row - `??` on the
 * row would hand back an empty string and the strip would render a bare icon.
 */
export function getTrustPointLabel(point: Translatable, locale: string): string {
  const rows = point.translations;
  return (
    rows.find((tr) => tr.locale === locale && tr.label.trim() !== "")?.label ??
    rows.find((tr) => tr.locale === DEFAULT_LOCALE && tr.label.trim() !== "")?.label ??
    rows.find((tr) => tr.label.trim() !== "")?.label ??
    ""
  );
}

/** The second line, or null. Same fallback order; blank is treated as absent. */
export function getTrustPointSublabel(
  point: Translatable,
  locale: string,
): string | null {
  const rows = point.translations;
  const pick = (row?: TrustPointTranslationRow) => {
    const value = row?.sublabel?.trim();
    return value ? value : undefined;
  };
  return (
    pick(rows.find((tr) => tr.locale === locale)) ??
    pick(rows.find((tr) => tr.locale === DEFAULT_LOCALE)) ??
    pick(rows.find((tr) => tr.sublabel?.trim())) ??
    null
  );
}
