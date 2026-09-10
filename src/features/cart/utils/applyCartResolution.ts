import { useCartStore, type CartItem } from "../store/cartStore";
import type { CartItemRef, CartLinePrice } from "../db/resolveCart";

/**
 * Brings the client cart in line with what the server just resolved: live prices
 * on every line that still exists, and the ones that don't dropped.
 *
 * Both halves belong together. The prices decide what the buyer is shown and the
 * pruning decides what they are shown at all, and they come from the same
 * resolution - applying one without the other is how the page ends up describing
 * a cart that no longer exists. `onRemoved` is called per dropped line so the
 * caller can say so in its own words; removal is never silent.
 *
 * REMOVAL IS ANNOUNCED EXACTLY ONCE, however many callers there are. On the
 * checkout page the drawer sits in the header and both of them resolve the same
 * cart in parallel - the drawer to refresh its prices, the page to work out
 * delivery - so the same dead line comes back to both as unavailable. Reading
 * the store fresh per line, and skipping one that is already gone, is what makes
 * the second caller quiet. Taking a single snapshot up front instead let both of
 * them announce it, and the one that lost the race looked the item up in a
 * snapshot it had already been removed from, so its toast named nothing at all.
 */
export function applyCartResolution(
  res: { prices: CartLinePrice[]; unavailable: CartItemRef[] },
  onRemoved: (removed: CartItem) => void,
): void {
  const { syncPrices, removeItem } = useCartStore.getState();
  syncPrices(res.prices);
  for (const u of res.unavailable) {
    // Fresh per iteration, not hoisted: `removeItem` below rewrites the array,
    // and so may another caller between two of these callbacks.
    const stale = useCartStore
      .getState()
      .items.find((i) => i.productId === u.productId && i.variantId === u.variantId);
    // Already pruned - by an earlier line here, or by whoever got here first.
    if (!stale) continue;
    removeItem(u.productId, u.variantId);
    onRemoved(stale);
  }
}
