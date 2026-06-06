import { asLocale, type Locale } from "./config";

/**
 * Placeholder example *nouns* for the admin translation forms, keyed by the
 * locale of the section they appear in - not the active UI language.
 *
 * Each translation form renders one section per locale (English, Serbian,
 * German, Spanish). For the name + slug fields the example should read in that
 * section's own language: the German "Name" field hints "Elektronik", the
 * Serbian one "Elektronika", so an admin always sees an example of the text
 * they are expected to type there.
 *
 * These cannot come from next-intl's `t()` - that only resolves strings in the
 * current UI locale, whereas here we need, say, the German example even while
 * the UI is in Serbian. Hence plain per-locale constants.
 *
 * Only the concrete example noun is section-specific. Generic hints (the "e.g."
 * lead-in, description placeholders, all product-field hints) follow the UI
 * language and stay in the message files; the lead-in is applied via
 * {@link withEgPrefix}.
 */
type LocaleExamples = Record<Locale, string>;

/** UI-language lead-in for example nouns ("e.g. Electronics" / "npr. Elektronika"). */
const EG_PREFIX: Record<Locale, string> = {
  en: "e.g.",
  sr: "npr.",
  de: "z. B.",
  es: "ej.",
};

/**
 * Prefix a bare example noun with the "e.g." lead-in for the active UI locale.
 * The prefix follows the UI language; the example itself stays in its own
 * (section) language - e.g. with a Serbian UI: `npr. Electronics`.
 */
export function withEgPrefix(uiLocale: string, example: string): string {
  return `${EG_PREFIX[asLocale(uiLocale)]} ${example}`;
}

export const CATEGORY_EXAMPLES: {
  name: LocaleExamples;
  slug: LocaleExamples;
} = {
  name: { en: "Electronics", sr: "Elektronika", de: "Elektronik", es: "Electrónica" },
  slug: { en: "electronics", sr: "elektronika", de: "elektronik", es: "electronica" },
};

export const BRAND_EXAMPLES: {
  name: LocaleExamples;
  slug: LocaleExamples;
} = {
  name: { en: "Nike", sr: "Najki", de: "Nike", es: "Nike" },
  slug: { en: "nike", sr: "najki", de: "nike", es: "nike" },
};

export const ATTRIBUTE_EXAMPLES: {
  /** Example attribute label per section locale (e.g. the "Color" attribute). */
  label: LocaleExamples;
  /** Example option label per section locale (e.g. the "Red" option). */
  option: LocaleExamples;
} = {
  label: { en: "Color", sr: "Boja", de: "Farbe", es: "Color" },
  option: { en: "Red", sr: "Crvena", de: "Rot", es: "Rojo" },
};
