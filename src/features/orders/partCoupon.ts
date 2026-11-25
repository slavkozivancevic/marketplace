import { platformFeeSlice } from "@/features/payments/config";

/**
 * A seller part's coupon arithmetic - pure, so it can run anywhere the payout
 * maths does (the detail page, the list's skeleton shape, their tests) without
 * pulling the database client in with it. `db/sellerParts.ts` re-exports these
 * for the callers that already import them from there.
 */

/** The coupon and goods a part carries - all `couponSliceAt` needs. */
export type PartCouponBasis = { itemsSubtotal: number; discountShare: number } | null;

/**
 * How much of this part's coupon share rides on `gross` worth of its goods.
 *
 * Taken from the PART, never re-derived from an order-level ratio: the coupon
 * was split across the parts once, at checkout, by a rule that floors each share
 * and hands the remainder to the largest (`buildSellerParts`), so the parts are
 * the only place that knows to the unit what each seller's goods were discounted
 * by. An order-level ratio agrees only when the split happened to divide evenly.
 *
 * Capped at the part's own goods: a caller must never be told that more coupon
 * came back than ever went out.
 */
export function couponSliceAt(gross: number, part: PartCouponBasis): number {
  const subtotal = part?.itemsSubtotal ?? 0;
  const discount = part?.discountShare ?? 0;
  if (discount <= 0 || subtotal <= 0) return 0;
  return Math.round((discount * Math.min(gross, subtotal)) / subtotal);
}

/**
 * What comes off a COD seller's balance when `gross` worth of their goods is
 * returned: the commission on those goods, less the coupon slice that rode on
 * them. The same shape `markCodPaymentReceived` accrued (`fee - discountShare`),
 * because anything else leaves the seller owing a commission on goods they no
 * longer hold. Can be negative - the platform's own credit shrinking - which is
 * a real state, not an error.
 *
 * `priorGross` is everything already returned for this (order, seller), so the
 * pieces telescope - see {@link platformFeeSlice}.
 */
export function codCommissionBack(
  priorGross: number,
  gross: number,
  part: PartCouponBasis,
): number {
  const couponBack = couponSliceAt(priorGross + gross, part) - couponSliceAt(priorGross, part);
  return platformFeeSlice(priorGross, gross) - couponBack;
}
