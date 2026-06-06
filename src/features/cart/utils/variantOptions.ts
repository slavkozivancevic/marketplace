import { SUPPORTED_LOCALES, DEFAULT_LOCALE } from "@/i18n/config";
import {
  getOptionName,
  getOptionValue,
} from "@/features/products/utils/optionTranslations";

/** A string snapshotted for every supported locale (locale -> text). */
export type LocalizedText = Record<string, string>;

/**
 * Snapshots a value for every supported locale via a per-locale getter. Used at
 * add-to-cart time so persisted cart fields (title, option values) can follow a
 * later locale switch even though the drawer has no product loaded.
 */
export function buildLocalizedText(
  get: (locale: string) => string,
): LocalizedText {
  const out: LocalizedText = {};
  for (const loc of SUPPORTED_LOCALES) out[loc] = get(loc);
  return out;
}

/**
 * Reads a localized snapshot in the active locale, falling back to the default
 * locale, then any available translation, then `fallback` (a legacy/plain
 * string stored before the field was localized).
 */
export function pickLocalized(
  map: LocalizedText | null | undefined,
  locale: string,
  fallback: string,
): string {
  return (
    map?.[locale] ??
    map?.[DEFAULT_LOCALE] ??
    (map ? Object.values(map)[0] : undefined) ??
    fallback
  );
}

/**
 * One selected variant option, with its name and value pre-translated for
 * every locale. We snapshot all locales at add-to-cart time because the cart
 * is persisted in localStorage and the CartDrawer has no product loaded to
 * translate against later - so the label can still follow a locale switch.
 */
export type CartVariantOption = {
  name: LocalizedText;
  value: LocalizedText;
};

// Minimal option projection both translation helpers need (id to match the
// variant's optionValues, translations carrying per-locale name + values map).
type OptionInput = {
  id: string;
  translations: readonly { locale: string; name: string; values: unknown }[];
};

/**
 * Builds the localized option snapshots for a variant by joining the variant's
 * canonical optionValues with the product's option translations.
 */
export function buildCartVariantOptions(
  optionValues: readonly { optionId: string; value: string }[],
  options: readonly OptionInput[],
): CartVariantOption[] {
  return optionValues.map((ov) => {
    const option = options.find((o) => o.id === ov.optionId);
    return {
      name: buildLocalizedText((loc) =>
        option ? getOptionName(option, loc) : "",
      ),
      value: buildLocalizedText((loc) =>
        option ? getOptionValue(option, ov.value, loc) : ov.value,
      ),
    };
  });
}

/**
 * Renders a cart item's variant label in the active locale, falling back to
 * the default locale, then any available translation, then `fallback` (the
 * stored SKU / legacy label) for variants without translatable options.
 */
export function localizedVariantLabel(
  variantOptions: CartVariantOption[] | null | undefined,
  locale: string,
  fallback?: string | null,
): string | null {
  if (variantOptions && variantOptions.length > 0) {
    const label = variantOptions
      .map(
        (o) =>
          o.value[locale] ??
          o.value[DEFAULT_LOCALE] ??
          Object.values(o.value)[0] ??
          "",
      )
      .filter(Boolean)
      .join(" / ");
    if (label) return label;
  }
  return fallback ?? null;
}
