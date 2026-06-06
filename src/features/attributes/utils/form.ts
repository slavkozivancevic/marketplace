import { DEFAULT_LOCALE, NON_DEFAULT_LOCALES } from "@/i18n/config";
import type { AttributeInput } from "../schema/attributes";
import type { AttributeDetail } from "../db/attributes";

type LabelRow = { locale: string; label: string };

function splitLabels(rows: readonly LabelRow[]): {
  label: string;
  translations: NonNullable<AttributeInput["translations"]>;
} {
  const label = rows.find((r) => r.locale === DEFAULT_LOCALE)?.label ?? "";
  const translations: Record<string, { label?: string }> = {};
  for (const locale of NON_DEFAULT_LOCALES) {
    translations[locale] = {
      label: rows.find((r) => r.locale === locale)?.label ?? "",
    };
  }
  return { label, translations };
}

/** Maps a persisted attribute into react-hook-form default values. */
export function attributeToFormValues(detail: AttributeDetail): AttributeInput {
  const { label, translations } = splitLabels(detail.translations);
  return {
    key: detail.key,
    type: detail.type,
    unit: detail.unit ?? "",
    label,
    translations,
    order: detail.order,
    options: detail.options.map((opt) => {
      const optLabels = splitLabels(opt.translations);
      return {
        id: opt.id,
        value: opt.value,
        label: optLabels.label,
        translations: optLabels.translations,
        order: opt.order,
      };
    }),
  };
}

/** Empty per-locale label map for a fresh attribute / option. */
export function emptyLabelTranslations(): NonNullable<
  AttributeInput["translations"]
> {
  const out: Record<string, { label?: string }> = {};
  for (const locale of NON_DEFAULT_LOCALES) out[locale] = { label: "" };
  return out;
}
