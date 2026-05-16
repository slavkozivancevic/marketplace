export type OptionTranslations = {
  sr?: {
    name?: string;
    values?: Record<string, string>;
  };
};

/** Returns the localized option name, falling back to the default (English) name. */
export function getOptionName(
  option: { name: string; translations: OptionTranslations | null },
  locale: string,
): string {
  if (locale === "sr") {
    const sr = option.translations?.sr?.name?.trim();
    if (sr) return sr;
  }
  return option.name;
}

/** Returns the localized option value, falling back to the default (English) value. */
export function getOptionValue(
  option: { translations: OptionTranslations | null },
  value: string,
  locale: string,
): string {
  if (locale === "sr") {
    const sr = option.translations?.sr?.values?.[value]?.trim();
    if (sr) return sr;
  }
  return value;
}