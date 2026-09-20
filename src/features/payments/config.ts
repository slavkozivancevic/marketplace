/**
 * Platform commission retained from each seller's order subtotal, in percent.
 * The rest is transferred to the seller's connected account. Kept as a constant
 * (not env) - it is product policy, not a secret, and must be identical on every
 * runtime that computes a transfer.
 */
export const PLATFORM_FEE_PERCENT = 10;

/**
 * Net amount (smallest currency unit) transferred to a seller for a given
 * subtotal, after the platform fee. Rounds the fee so the two always sum back to
 * the subtotal.
 */
export function sellerNetAmount(subtotal: number): number {
  const fee = Math.round((subtotal * PLATFORM_FEE_PERCENT) / 100);
  return subtotal - fee;
}

/**
 * Platform commission (smallest currency unit) on a given subtotal - the
 * complement of {@link sellerNetAmount}, so the two always sum back to subtotal.
 * For card orders this is kept implicitly (charge minus transfer); for COD it is
 * recorded as a FEE owed by the seller, since the seller collects the cash.
 */
export function platformFeeAmount(subtotal: number): number {
  return subtotal - sellerNetAmount(subtotal);
}

/**
 * Both amounts above ROUND, so charging them once on a whole is not the same as
 * charging them on each piece: at 10%, a subtotal of 10 keeps a fee of 1, while
 * two slices of 5 keep 1 each. Whenever goods come back a piece at a time -
 * returns - the amount unwound has to be the DIFFERENCE between the figure at
 * the new running total and the figure at the old one. That telescopes to
 * exactly the amount originally charged once the last unit is back, however the
 * units were grouped into returns.
 *
 * `priorGross` is everything already returned for this (order, seller); `gross`
 * is what is coming back now.
 */
export function sellerNetSlice(priorGross: number, gross: number): number {
  return sellerNetAmount(priorGross + gross) - sellerNetAmount(priorGross);
}

/** The commission half of {@link sellerNetSlice}, on the same running total. */
export function platformFeeSlice(priorGross: number, gross: number): number {
  return platformFeeAmount(priorGross + gross) - platformFeeAmount(priorGross);
}
