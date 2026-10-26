import { revalidatePath, updateTag } from "next/cache";
import { CacheTags } from "@/lib/cache/tags";

/**
 * Busts everything a market mutation touches.
 *
 * `updateTag`, not `revalidateTag(tag, "max")`: the admin goes straight back to
 * the list, and the storefront layout reads the market map on the very next
 * request - a stale-while-revalidate read would price one more page with the
 * old map. Server Actions only - no Route Handler writes markets.
 *
 * No product tag is touched: cached product payloads carry the rules, not the
 * map, and the map is applied per request from this entry.
 */
export function revalidatePriceMarketCache(marketId: string) {
  updateTag(CacheTags.priceMarkets.all());
  updateTag(CacheTags.priceMarkets.byId(marketId));

  // Route patterns, not concrete values - a literal id matches nothing.
  revalidatePath("/[locale]/admin/price-markets", "page");
  revalidatePath("/[locale]/admin/price-markets/[id]/edit", "page");
}
