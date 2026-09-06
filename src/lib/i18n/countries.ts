import { LOCALE_LABELS, asLocale } from "@/i18n/config";

/**
 * Country reference data for `Product.countryOfOrigin`.
 *
 * Only the ISO 3166-1 alpha-2 *code* is stored. Names are a display concern and
 * there are four of them per country, so they are resolved at render time by
 * `Intl.DisplayNames` instead of living in `messages/*.json` - roughly a
 * thousand translations the runtime already has.
 *
 * The list holds officially assigned alpha-2 codes only. User-assigned codes
 * (the XA-XZ range) are deliberately left out: they are not ISO-stable, and
 * `Product.countryOfOrigin` is a VarChar(8) precisely so codes outside this
 * list (alpha-3, UN M49, customs specials) can be stored later without a
 * migration - they just would not be offered by the picker.
 */
export const COUNTRY_CODES = [
  "AD", "AE", "AF", "AG", "AI", "AL", "AM", "AO", "AQ", "AR", "AS", "AT", "AU", "AW", "AX", "AZ",
  "BA", "BB", "BD", "BE", "BF", "BG", "BH", "BI", "BJ", "BL", "BM", "BN", "BO", "BQ", "BR", "BS",
  "BT", "BV", "BW", "BY", "BZ",
  "CA", "CC", "CD", "CF", "CG", "CH", "CI", "CK", "CL", "CM", "CN", "CO", "CR", "CU", "CV", "CW",
  "CX", "CY", "CZ",
  "DE", "DJ", "DK", "DM", "DO", "DZ",
  "EC", "EE", "EG", "EH", "ER", "ES", "ET",
  "FI", "FJ", "FK", "FM", "FO", "FR",
  "GA", "GB", "GD", "GE", "GF", "GG", "GH", "GI", "GL", "GM", "GN", "GP", "GQ", "GR", "GS", "GT",
  "GU", "GW", "GY",
  "HK", "HM", "HN", "HR", "HT", "HU",
  "ID", "IE", "IL", "IM", "IN", "IO", "IQ", "IR", "IS", "IT",
  "JE", "JM", "JO", "JP",
  "KE", "KG", "KH", "KI", "KM", "KN", "KP", "KR", "KW", "KY", "KZ",
  "LA", "LB", "LC", "LI", "LK", "LR", "LS", "LT", "LU", "LV", "LY",
  "MA", "MC", "MD", "ME", "MF", "MG", "MH", "MK", "ML", "MM", "MN", "MO", "MP", "MQ", "MR", "MS",
  "MT", "MU", "MV", "MW", "MX", "MY", "MZ",
  "NA", "NC", "NE", "NF", "NG", "NI", "NL", "NO", "NP", "NR", "NU", "NZ",
  "OM",
  "PA", "PE", "PF", "PG", "PH", "PK", "PL", "PM", "PN", "PR", "PS", "PT", "PW", "PY",
  "QA",
  "RE", "RO", "RS", "RU", "RW",
  "SA", "SB", "SC", "SD", "SE", "SG", "SH", "SI", "SJ", "SK", "SL", "SM", "SN", "SO", "SR", "SS",
  "ST", "SV", "SX", "SY", "SZ",
  "TC", "TD", "TF", "TG", "TH", "TJ", "TK", "TL", "TM", "TN", "TO", "TR", "TT", "TV", "TW", "TZ",
  "UA", "UG", "UM", "US", "UY", "UZ",
  "VA", "VC", "VE", "VG", "VI", "VN", "VU",
  "WF", "WS",
  "YE", "YT",
  "ZA", "ZM", "ZW",
] as const;

export type CountryCode = (typeof COUNTRY_CODES)[number];

const CODE_SET: ReadonlySet<string> = new Set(COUNTRY_CODES);

export function isCountryCode(value: unknown): value is CountryCode {
  return typeof value === "string" && CODE_SET.has(value);
}

/**
 * Trims and uppercases a user-supplied code (CSV import, API payloads) and
 * returns it only if it is a known country. Empty input and unknown codes both
 * come back as `null`, which is what the column stores for "unspecified".
 */
export function normalizeCountryCode(value: unknown): CountryCode | null {
  if (typeof value !== "string") return null;
  const code = value.trim().toUpperCase();
  return isCountryCode(code) ? code : null;
}

/**
 * The BCP 47 tag to render names in. Comes from the central locale config, so
 * Serbian resolves to `sr-Latn` - plain `sr` would return Cyrillic names
 * ("Немачка") in an interface that is Latin everywhere else.
 */
function displayLocale(locale: string): string {
  return LOCALE_LABELS[asLocale(locale)].bcp47;
}

// Constructing an Intl formatter is the expensive part, so both the formatter
// and the fully sorted list are memoized per locale. Four locales, so these
// maps never grow beyond four entries.
const displayNamesCache = new Map<string, Intl.DisplayNames | null>();
const sortedCache = new Map<string, ReadonlyArray<{ code: CountryCode; name: string }>>();

function getDisplayNames(locale: string): Intl.DisplayNames | null {
  const tag = displayLocale(locale);
  const cached = displayNamesCache.get(tag);
  if (cached !== undefined) return cached;
  let instance: Intl.DisplayNames | null = null;
  try {
    instance = new Intl.DisplayNames(tag, { type: "region" });
  } catch {
    // A runtime without full ICU (or an unexpected tag) - callers fall back to
    // the bare code rather than crashing a product page over a label.
    instance = null;
  }
  displayNamesCache.set(tag, instance);
  return instance;
}

/**
 * Localized country name for a code, e.g. `("DE", "sr") -> "Nemačka"`.
 * Falls back to the code itself for anything the runtime cannot resolve - the
 * value is still meaningful to a human, which a blank would not be.
 */
export function countryName(code: string, locale: string): string {
  const resolved = getDisplayNames(locale)?.of(code);
  return resolved ?? code;
}

/** Every country as `{ code, name }`, ordered by localized name. */
export function sortedCountries(
  locale: string,
): ReadonlyArray<{ code: CountryCode; name: string }> {
  const tag = displayLocale(locale);
  const cached = sortedCache.get(tag);
  if (cached) return cached;
  // Collator, not a plain string compare: Serbian and Spanish diacritics sort
  // in the wrong place otherwise (Č after Z, Ñ after Z).
  const collator = new Intl.Collator(tag);
  const list = COUNTRY_CODES.map((code) => ({
    code,
    name: countryName(code, locale),
  })).sort((a, b) => collator.compare(a.name, b.name));
  sortedCache.set(tag, list);
  return list;
}

/**
 * Diacritic- and case-insensitive key for search matching, so typing
 * "nemacka" finds "Nemačka" and "espana" finds "España".
 */
export function foldForSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}
