"use server";

import {
  resolveCart,
  cartLinePrices,
  type CartItemRef,
  type CartLinePrice,
} from "../db/resolveCart";

/**
 * Re-reads the live price of every cart line, plus the lines that no longer
 * resolve to a purchasable product.
 *
 * The cart store persists the price it snapshotted at add-to-cart time, so the
 * drawer keeps showing that number long after the seller has changed it, while
 * checkout - which always re-reads the DB - charges the new one. This is the
 * cheap read the drawer runs when it opens so the two can never disagree.
 *
 * The checkout page does not call this: `getCartShippingAction` already resolves
 * the cart and returns the same payload, so it would be a second resolution pass
 * for nothing.
 */
export async function refreshCartAction(
  items: CartItemRef[],
): Promise<{ prices: CartLinePrice[]; unavailable: CartItemRef[] }> {
  const { lines, unavailable } = await resolveCart(items);
  return { prices: cartLinePrices(lines), unavailable };
}
