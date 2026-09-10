"use server";

import {
  resolveCart,
  cartLinePrices,
  type CartItemRef,
  type CartLinePrice,
} from "@/features/cart/db/resolveCart";
import {
  shippingLinesForResolved,
  shippingTotal,
  shippingTotalUsd,
  type OrgShippingLine,
} from "../db/shipping";
import { getMoneyContext } from "@/features/currency/db/activeCurrency";
import type { Currency } from "@/lib/currency-config";

/**
 * Per-seller delivery for the current cart, for the checkout summary.
 *
 * Resolved in the buyer's currency - read from the cookie here rather than
 * taken as an argument, because it decides whether shipping is free. Every
 * amount on the returned lines is already in that currency, so the client
 * renders them directly instead of converting.
 *
 * Also returns any cart lines that no longer resolve to a purchasable product
 * (`unavailable`), so the client can prune them and keep the cart honest - this
 * is the signal that drives the self-healing cart on the checkout page.
 *
 * `prices` carries the authoritative unit price of every resolved line. The
 * cart already resolves here, so returning it costs nothing and lets the client
 * refresh the price snapshot it took at add-to-cart time. Without it the summary
 * renders stale line prices while shipping, coupons and the actual charge were
 * all computed from the live ones.
 */
export async function getCartShippingAction(
  items: CartItemRef[],
): Promise<{
  lines: OrgShippingLine[];
  total: number;
  currency: Currency;
  totalUsd: number;
  unavailable: CartItemRef[];
  prices: CartLinePrice[];
}> {
  const ctx = await getMoneyContext();
  const { lines: resolvedLines, unavailable } = await resolveCart(items);
  const lines = await shippingLinesForResolved(resolvedLines, ctx);
  return {
    lines,
    total: shippingTotal(lines),
    currency: ctx.currency,
    totalUsd: shippingTotalUsd(lines),
    unavailable,
    prices: cartLinePrices(resolvedLines),
  };
}
