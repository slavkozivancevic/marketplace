import "server-only";
import { cookies, headers } from "next/headers";
import type { MarketViewer } from "@/features/pricing/engine/market";
import { normalizeCountryCode } from "@/lib/i18n/countries";
import { COUNTRY_COOKIE, viewerFor } from "../utils/markets";
import { getPriceMarketConfig } from "./markets";

/**
 * The country a request prices as, before the market map is applied.
 *
 * The cookie wins: it is either the buyer's own choice or the proxy's seed.
 * The CloudFront header is read only for the very first request, whose
 * cookie the proxy is setting on that same response and which the server
 * therefore cannot see yet. `x-open-next-country` is the copy SST's viewer
 * function makes of it. Never part of a cache key - see the dynamic-pricing
 * spec, Constraint 7.
 */
export async function getViewerCountry(): Promise<string | null> {
  const [store, hdrs] = await Promise.all([cookies(), headers()]);
  return (
    normalizeCountryCode(store.get(COUNTRY_COOKIE)?.value) ??
    normalizeCountryCode(hdrs.get("cloudfront-viewer-country") ?? hdrs.get("x-open-next-country"))
  );
}

/** Who this request prices as: country, market, and the map's age. */
export async function getViewerMarket(): Promise<MarketViewer> {
  const [country, config] = await Promise.all([getViewerCountry(), getPriceMarketConfig()]);
  return viewerFor(country, config);
}
