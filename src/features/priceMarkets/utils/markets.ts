import { DEFAULT_LOCALE } from "@/i18n/config";
import type { MarketViewer } from "@/features/pricing/engine/market";

/**
 * The buyer's pricing country (ISO alpha-2). Set by the country selector, and
 * seeded once by the proxy from CloudFront's viewer country - never overwritten
 * by it. Read per request; never part of a cache key.
 */
export const COUNTRY_COOKIE = "NEXT_COUNTRY";
export const COUNTRY_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export type PriceMarketTranslationRow = { locale: string; name: string };

/** A market as every reader outside the admin form needs it. */
export type PriceMarketSummary = {
  id: string;
  isDefault: boolean;
  translations: PriceMarketTranslationRow[];
  /** ISO alpha-2 codes; always empty on the default market. */
  countries: string[];
};

/**
 * The whole market map, small enough to cache as one entry and to hand to the
 * client: a platform has a handful of markets and at most ~250 countries.
 */
export type PriceMarketConfig = {
  defaultId: string;
  /** Country code -> market id. A country missing here is in the default market. */
  byCountry: Record<string, string>;
  /**
   * Country code -> when it last changed market (added to one, removed from
   * one, its market deleted), as ISO. Omnibus needs it: a buyer's market price
   * may show a 30-day reference only if their country did not move inside
   * those 30 days. A country missing here never moved.
   */
  countryMovedAt: Record<string, string>;
  markets: PriceMarketSummary[];
};

/** Who a country prices as. No country, or an unmapped one, is the default market. */
export function viewerFor(country: string | null, config: PriceMarketConfig): MarketViewer {
  return {
    country,
    // `defaultId` is "" only on a database missing its default market (see
    // getPriceMarketConfig); null then matches no rule, i.e. the neutral price.
    marketId: (country && config.byCountry[country]) || config.defaultId || null,
    countryMovedAt: (country && config.countryMovedAt[country]) || null,
  };
}

/**
 * The market's name in the reader's language, falling back to the default
 * locale and then to any row. Blank counts as absent, as in the other
 * translated entities - `??` on the row would hand back an empty string.
 */
export function getPriceMarketName(
  market: { translations: readonly PriceMarketTranslationRow[] },
  locale: string,
): string {
  const rows = market.translations;
  return (
    rows.find((tr) => tr.locale === locale && tr.name.trim() !== "")?.name ??
    rows.find((tr) => tr.locale === DEFAULT_LOCALE && tr.name.trim() !== "")?.name ??
    rows.find((tr) => tr.name.trim() !== "")?.name ??
    ""
  );
}
