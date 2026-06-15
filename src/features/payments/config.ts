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
