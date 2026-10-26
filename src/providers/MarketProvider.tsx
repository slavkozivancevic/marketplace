"use client";

import { createContext, useCallback, useContext, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { MarketViewer } from "@/features/pricing/engine/market";
import {
  COUNTRY_COOKIE,
  COUNTRY_COOKIE_MAX_AGE,
  viewerFor,
  type PriceMarketConfig,
} from "@/features/priceMarkets/utils/markets";
import {
  listItemForViewer,
  productForViewer,
  type ViewerPricedProduct,
} from "@/features/priceMarkets/utils/viewerPrices";
import { normalizeCountryCode } from "@/lib/i18n/countries";
import type { SerializedProductListItem, SerializedPublicProduct } from "@/types/types";

const NO_MARKET: MarketViewer = { country: null, marketId: null, countryMovedAt: null };

type MarketContextValue = {
  viewer: MarketViewer;
  setCountry: (country: string) => void;
};

const MarketContext = createContext<MarketContextValue>({ viewer: NO_MARKET, setCountry: () => {} });

// Module-level so the React Compiler doesn't flag the document.cookie write
// as mutating a global from inside the component (same pattern as ThemeProvider).
function persistCountryCookie(country: string) {
  document.cookie = `${COUNTRY_COOKIE}=${country}; path=/; max-age=${COUNTRY_COOKIE_MAX_AGE}; SameSite=Lax`;
}

/**
 * The viewer's pricing country and market, resolved on the server from the
 * NEXT_COUNTRY cookie and handed down - the way CurrencyRatesProvider hands
 * down the currency. Product payloads stay viewer-neutral (cacheable, and safe
 * behind a CDN); every price component reads them through the hooks below.
 *
 * Changing country applies at once on the client: the market map is small and
 * already here, so `viewerFor` gives the new market without a round trip and
 * every price repaints in the same frame. The cookie is written first, so any
 * server action from then on (the cart's re-resolve) prices in the new
 * country; `router.refresh()` then brings the server-rendered parts along in
 * the background.
 */
export function MarketProvider({
  country,
  config,
  children,
}: {
  country: string | null;
  config: PriceMarketConfig;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  // The buyer's pick, tied to the server country it was made over. Once the
  // refresh hands down a new server country the pick no longer matches and the
  // server value - by then the same country - takes over, with no effect to sync.
  const [picked, setPicked] = useState<{ over: string | null; country: string } | null>(null);
  const effective = picked && picked.over === country ? picked.country : country;

  const setCountry = useCallback(
    (next: string) => {
      const code = normalizeCountryCode(next);
      if (!code || code === effective) return;
      persistCountryCookie(code);
      setPicked({ over: country, country: code });
      startTransition(() => router.refresh());
    },
    [country, effective, router],
  );

  const value = useMemo(
    () => ({ viewer: viewerFor(effective, config), setCountry }),
    [effective, config, setCountry],
  );

  return <MarketContext.Provider value={value}>{children}</MarketContext.Provider>;
}

export function useViewerMarket(): MarketViewer {
  return useContext(MarketContext).viewer;
}

/** Switches the pricing country - see MarketProvider. */
export function useSetViewerCountry(): (country: string) => void {
  return useContext(MarketContext).setCountry;
}

/** A card's product priced for this viewer - see `listItemForViewer`. */
export function useMarketListItem<T extends SerializedProductListItem>(item: T) {
  const viewer = useViewerMarket();
  return useMemo(() => listItemForViewer(item, viewer), [item, viewer]);
}

/** A product page's product priced for this viewer - see `productForViewer`. */
export function useMarketProduct<P extends SerializedPublicProduct>(product: P): ViewerPricedProduct<P>;
export function useMarketProduct<P extends SerializedPublicProduct>(
  product: P | undefined,
): ViewerPricedProduct<P> | undefined;
export function useMarketProduct<P extends SerializedPublicProduct>(product: P | undefined) {
  const viewer = useViewerMarket();
  return useMemo(() => (product ? productForViewer(product, viewer) : undefined), [product, viewer]);
}
