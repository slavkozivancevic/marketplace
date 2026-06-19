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
