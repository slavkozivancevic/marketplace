/**
 * The order every transaction that changes stock walks its lines in.
 *
 * Each stock UPDATE holds its row's lock until the transaction commits. Two
 * transactions that take the same rows in opposite order - buyer 1's cart is
 * [A, B], buyer 2's is [B, A] - each end up holding one row and waiting for the
 * other, and Postgres aborts one of them with "deadlock detected" after a
 * second's wait. On the COD path that buyer is shown an error; on the card path
 * the webhook answers 500 and the paid order only appears on Stripe's retry.
 *
 * Sorting by one key everywhere removes the cycle: whoever gets the first
 * shared row first goes through, the other waits for it and then follows.
 * Product rows before variant rows, parent before child, the same way the
 * price-rule write takes them (`lockProduct`, then the variants); each group by
 * id. Plain code-unit comparison, not `localeCompare`, so the order can never
 * depend on the server's locale.
 *
 * Every path that changes stock goes through this: both checkouts, the Stripe
 * refund restock, the return restock and the seller cancellation. A new one must
 * too - one path in cart order is enough to bring the deadlock back.
 *
 * Returns a sorted copy; the caller's array keeps its order, which is the order
 * the buyer sees their lines in.
 */
export function inStockLockOrder<T extends { productId: string; variantId?: string | null }>(
  lines: readonly T[],
): T[] {
  const key = (l: T) => (l.variantId ? `1:${l.variantId}` : `0:${l.productId}`);
  return [...lines].sort((a, b) => {
    const ka = key(a);
    const kb = key(b);
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  });
}
