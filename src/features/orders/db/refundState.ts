import { PaymentTransactionType, ReturnStatus } from "@/generated/prisma/client";
import type { TransactionClient } from "@/core/db/prisma";

/**
 * When is an order fully refunded?
 *
 * Both refund paths used to answer this from one aggregate of every REFUND row,
 * against two different bars - and the rows are not in the same unit. A row
 * written by the app's own return flow carries the GROSS of the returned goods,
 * because that is what the payout views net against. A row written by
 * `reconcileStripeRefund` carries what Stripe actually sent back to the buyer,
 * which is the discounted amount and may include delivery. Summing the two and
 * comparing to either bar mixes money that means different things.
 *
 * So the question is asked in the only unit both sides can agree on: what the
 * BUYER got back, against what the buyer paid for goods.
 *
 * Delivery is on neither side of that comparison - it is never refunded, and
 * leaving it in the bar made it unreachable: a dashboard refund of the goods
 * alone left the order PARTIALLY_REFUNDED for good, and since seller payouts are
 * only clawed back when an order turns REFUNDED, the sellers kept their
 * transfers for goods that had been given back.
 */

/**
 * What the buyer paid for goods on this order - the bar that means "all of it
 * has been returned". `total` is already net of the coupon and includes
 * delivery, so taking delivery off leaves exactly the goods as the buyer paid
 * for them.
 */
export function refundableFromBuyer(order: {
  total: number;
  shippingTotal: number;
}): number {
  return order.total - order.shippingTotal;
}

/**
 * How much of that has actually gone back.
 *
 * Returns contribute `Return.refundAmount`, the buyer-facing figure the refund
 * itself wrote (gross less the coupon slice riding on those units), not their
 * gross ledger row. External refunds contribute their own amount, which is
 * already what the buyer received.
 *
 * Takes the transaction client so a caller can ask immediately after writing its
 * own rows, inside the same transaction, and see them.
 */
export async function refundedToBuyer(
  client: TransactionClient,
  orderId: string,
): Promise<number> {
  const [external, returns] = await Promise.all([
    client.paymentTransaction.aggregate({
      where: {
        orderId,
        type: PaymentTransactionType.REFUND,
        // Order-level rows are the ones made outside the app; the app's own are
        // always scoped to the seller whose goods came back.
        organizationId: null,
      },
      _sum: { amount: true },
    }),
    client.return.aggregate({
      where: { orderId, status: ReturnStatus.REFUNDED },
      _sum: { refundAmount: true },
    }),
  ]);
  return (external._sum.amount ?? 0) + (returns._sum.refundAmount ?? 0);
}
