import { sellerNetAmount, platformFeeAmount } from "@/features/payments/config";
import { codCommissionBack, type PartCouponBasis } from "@/features/orders/db/sellerParts";

/**
 * Everything the seller's order page prints about money, in one pure place.
 *
 * It lives here rather than inline on the page because these figures only make
 * sense against each other: what was earned, what was withheld, what came back.
 * A page can render a wrong number without anything failing, so the rules are
 * kept where a test can hold them.
 */

export type SellerOrderMoneyInput = {
  isCod: boolean;
  /** This seller withdrew its part. Nothing was ever collected or paid out. */
  isCancelled: boolean;
  /** The ORDER reached REFUNDED - which can happen through another seller. */
  isFullyRefunded: boolean;
  /** This seller's goods in the order, gross, before commission or coupon. */
  orgSubtotal: number;
  /** Delivery this seller charged. Theirs in full - no commission on it. */
  orgShipping: number;
  /**
   * The same delivery as the part recorded it at checkout. Kept apart from
   * `orgShipping` on purpose: the cash figure a courier acts on is built from
   * the part snapshot, exactly as the buyer's order total is, so the two can
   * never disagree over what is being collected at the door.
   */
  partShipping: number;
  /** The seller's part, carrying its authoritative coupon share. */
  part: PartCouponBasis;
  /** Gross value of this seller's goods refunded through the app's returns. */
  orgRefundGross: number;
  /** Refunds made outside the app (Stripe dashboard), not attributed to a seller. */
  externalRefundGross: number;
  /** Amount of this org's SUCCEEDED payout row, or null if it has none. */
  payoutTxAmount: number | null;
};

export type SellerOrderMoney = {
  /**
   * Refunded to the buyer outside the app, while the order is NOT yet fully
   * refunded - so nothing has been taken from this seller for it, and the
   * platform is carrying it. Zero once the order goes REFUNDED, where the whole
   * transfer is reversed and the clawback lines say so.
   */
  externalRefundPending: number;
  orgItemsNet: number;
  orgPayout: number;
  codCashToCollect: number;
  codOwed: number;
  codCommissionCredited: number;
  codOwedAfterRefunds: number;
  payoutReversed: number;
  codNetted: number;
  payoutReversedFromTransfer: number;
  codDebtRestored: number;
  finalTransferred: number;
};

export function sellerOrderMoney({
  isCod,
  isCancelled,
  isFullyRefunded,
  orgSubtotal,
  orgShipping,
  partShipping,
  part,
  orgRefundGross,
  externalRefundGross,
  payoutTxAmount,
}: SellerOrderMoneyInput): SellerOrderMoney {
  const orgItemsNet = sellerNetAmount(orgSubtotal);
  const orgPayout = orgItemsNet + orgShipping;

  // COD money is the seller's own to hold, so it is spelled out separately from
  // the payout above. Both figures come off the part snapshot, which is what the
  // order total itself is built from - never recomputed from the items, or the
  // courier's number and the buyer's could drift apart.
  const partSubtotal = part?.itemsSubtotal ?? 0;
  const partDiscount = part?.discountShare ?? 0;
  const codCashToCollect = partSubtotal - partDiscount + partShipping;
  // What the platform is owed once that cash is in hand: its commission on the
  // goods, less the slice of the buyer's coupon it promised to fund. Negative
  // means the coupon ran deeper than the commission and the platform owes the
  // seller - see markCodPaymentReceived.
  const codOwed = platformFeeAmount(partSubtotal) - partDiscount;
  // ...and what has since come off that debt because goods came back. Same call
  // settleReturnRefund books, so the page cannot drift from the balance. Without
  // it the line kept reading "you owe the platform X" after every unit had been
  // returned and the debt was already nil.
  const codCommissionCredited =
    isCod && !isCancelled ? codCommissionBack(0, orgRefundGross, part) : 0;
  const codOwedAfterRefunds = codOwed - codCommissionCredited;

  // Refund-aware payout, computed the same way for Stripe and COD alike. COD
  // orders never get a PAYOUT ledger row (no platform-held funds to reverse -
  // see releaseSellerPayout), so this can't be read off a PAYOUT tx's own
  // reversedNet the way the ledger display does; it's re-derived here from the
  // same refund-gross figures the query already computed for the FEE row.
  //
  // Only the app's own returns count here. A refund issued outside the app - from
  // the Stripe dashboard - takes nothing from the seller unless it finishes the
  // order off: `reconcileStripeRefund` calls `reverseSellerPayoutsForOrder` only
  // on the crossing into REFUNDED, and that reverses the whole transfer at once,
  // which the `isFullyRefunded` branch below already covers. Counting a partial
  // one here drew a clawback line for money that never left the seller. It is
  // not hidden instead - `externalRefundPending` below says it plainly.
  const grossPayoutBack = sellerNetAmount(orgRefundGross);
  // Delivery is never refunded to the buyer, so it is never clawed back from
  // the seller either: the ceiling is their net on GOODS, not their whole
  // payout.
  //
  // A withdrawn seller is outside all of this. `isFullyRefunded` is a fact about
  // the ORDER, and an order reaches REFUNDED on the goods that are still in it -
  // so when one seller withdraws and the other's goods all come back, this said
  // the withdrawn seller's whole net had been clawed back. It never was: nothing
  // was collected for those goods and nothing was paid out for them.
  const payoutReversed = isCancelled
    ? 0
    : isFullyRefunded
      ? orgItemsNet
      : Math.min(orgItemsNet, grossPayoutBack);

  // A succeeded Stripe transfer for this order may have been reduced below
  // orgPayout to net this org's COD commission balance against it (see
  // releaseSellerPayout) - the withheld slice never reaches the seller's
  // connected account. Compared against orgPayout (not the refund-adjusted
  // figure): the netting happens once at ship time, before any later refund, so
  // it is independent of payoutReversed - mixing the two would misattribute the
  // gap between them when an order has both. The two effects instead stack in
  // finalTransferred: what was actually transferred, minus any later clawback.
  const codNetted = payoutTxAmount != null ? Math.max(0, orgPayout - payoutTxAmount) : 0;
  // The clawback cannot exceed what the transfer actually moved - Stripe
  // rejects a reversal larger than its transfer, so settleReturnRefund caps it
  // and puts the uncovered slice back on the COD balance as debt owed
  // (`codDebtShortfall`): it was never cash in the seller's hands, it was debt
  // relief when the payout was netted, and the refund undoes that relief.
  // Subtracting the FULL net here instead showed a negative final payout, as
  // if the seller owed cash for this order. They do not - the cash nets to
  // zero and the withheld part reappears as debt, which the note explains.
  const payoutReversedFromTransfer =
    payoutTxAmount != null ? Math.min(payoutReversed, payoutTxAmount) : payoutReversed;
  const codDebtRestored = payoutReversed - payoutReversedFromTransfer;
  const finalTransferred =
    payoutTxAmount != null
      ? payoutTxAmount - payoutReversedFromTransfer
      : orgPayout - payoutReversed;

  return {
    externalRefundPending: isFullyRefunded || isCancelled ? 0 : externalRefundGross,
    orgItemsNet,
    orgPayout,
    codCashToCollect,
    codOwed,
    codCommissionCredited,
    codOwedAfterRefunds,
    payoutReversed,
    codNetted,
    payoutReversedFromTransfer,
    codDebtRestored,
    finalTransferred,
  };
}
