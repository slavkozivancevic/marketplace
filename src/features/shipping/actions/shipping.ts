"use server";

import { resolveCart, type CartItemRef } from "@/features/cart/db/resolveCart";
import { shippingLinesForResolved, shippingTotalUsd, type OrgShippingLine } from "../db/shipping";

/**
 * Per-seller delivery for the current cart, for the checkout summary. Money is
 * returned in USD base cents - the client converts to the display currency the
 * same way it converts item prices, so everything stays consistent.
 *
 * Also returns any cart lines that no longer resolve to a purchasable product
 * (`unavailable`), so the client can prune them and keep the cart honest - this
 * is the signal that drives the self-healing cart on the checkout page.
 */
export async function getCartShippingAction(
  items: CartItemRef[],
): Promise<{ lines: OrgShippingLine[]; totalUsd: number; unavailable: CartItemRef[] }> {
  const { lines: resolvedLines, unavailable } = await resolveCart(items);
  const lines = await shippingLinesForResolved(resolvedLines);
  return { lines, totalUsd: shippingTotalUsd(lines), unavailable };
}
