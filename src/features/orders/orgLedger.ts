import { sellerNetAmount } from "@/features/payments/config";
import { codCommissionBack, type PartCouponBasis } from "./partCoupon";

type LedgerTxn = {
  type: string;
  amount: number;
  organizationId: string | null;
};

/**
 * This seller's view of an order's ledger: the rows it may see, each annotated
 * with how much of it refunds have clawed back, plus the refund totals the
 * payout breakdown needs. Shared by the detail page (`getOrgOrderById`) and the
 * list's skeleton shape (`buildOrgOrderDetailShape`), so the two cannot disagree
 * about which rows the page shows. Pure - string literals, not Prisma enums, as
 * in status.ts - so it runs in tests and anywhere else without the database.
 */
export function orgLedger<T extends LedgerTxn>(
  txns: T[],
  organizationId: string,
  paymentStatus: string,
  orgPart: PartCouponBasis,
) {
  // Annotate this org's PAYOUT/FEE row(s) with how much was clawed back by
  // refunds, mirroring the payouts table (see getPayoutRefundContext in
  // payments/db/payouts.ts - same math, kept in sync by hand since this query
  // already has the transactions loaded).
  //
  // Two very different signals feed this: org-scoped (app Return flow)
  // refunds are exact - we know these are this seller's items. Order-level
  // (manual/external Stripe dashboard) refunds are NOT scoped to a seller, so
  // only trust "the whole payout is gone" once the order is actually fully
  // refunded (order.paymentStatus REFUNDED - exactly when
  // reverseSellerPayoutsForOrder runs). A partial external refund is netted
  // through sellerNetAmount/platformFeeAmount and capped at this row's own
  // amount - an honest upper-bound estimate, never claiming money is gone
  // that wasn't.
  // Loaded unscoped because the refund maths below needs the order-level rows,
  // but NOT all of it may be handed back - see the filter under `visibleTxns`.
  const orgRefundGross = txns
    .filter((t) => t.type === "REFUND" && t.organizationId === organizationId)
    .reduce((sum, t) => sum + t.amount, 0);
  const externalRefundGross = txns
    .filter((t) => t.type === "REFUND" && t.organizationId === null)
    .reduce((sum, t) => sum + t.amount, 0);
  const isFullyRefunded = paymentStatus === "REFUNDED";

  // A seller's ledger shows money movements that involve that seller, and
  // nothing else. Carts are multi-seller, so the unscoped list handed one seller
  // its competitors' PAYOUT and FEE amounts - their net revenue on the order -
  // along with a CHARGE covering everyone's goods. Kept here: this org's own
  // rows, plus order-level REFUNDs, which are not attributed to a seller yet do
  // claw back this one's payout, so it is owed the explanation.
  const visibleTxns = txns.filter(
    (t) =>
      t.organizationId === organizationId ||
      (t.organizationId === null && t.type === "REFUND"),
  );

  const paymentTransactions = visibleTxns.map((t) => {
    // PAYOUT (seller net) and FEE (platform commission) are both clawed back /
    // credited proportionally when this org's items are refunded. A PAYOUT
    // reverses sellerNetAmount(refundedGross); a FEE credits what
    // settleReturnRefund actually took off the balance.
    const isPayout = t.type === "PAYOUT" && t.organizationId === organizationId;
    const isFee = t.type === "FEE" && t.organizationId === organizationId;
    if (!isPayout && !isFee) {
      return { ...t, refundState: "none" as const, reversedNet: 0 };
    }
    // A FEE was accrued NET of the coupon slice the platform funds
    // (markCodPaymentReceived), so the credit that comes back is net of it too -
    // `codCommissionBack`, the same call the refund itself books. Reading the
    // gross commission here instead overstated the credit by that slice: on
    // goods of 1000 with a 30 coupon and a 100 commission, returning half gives
    // the seller 35 back and the row claimed 50.
    //
    // Refunds made outside the app are left out of both. Nothing is reversed for
    // them until the order goes fully REFUNDED, and the branch below hands back
    // the whole row in that case anyway - so counting a partial one marked these
    // rows "partially refunded" while every cent of them still stood.
    const grossBack = isPayout
      ? sellerNetAmount(orgRefundGross)
      : codCommissionBack(0, orgRefundGross, orgPart);
    // A FEE can be negative - the platform owing the seller for a coupon deeper
    // than its commission - and then the credit coming back is negative too:
    // that debt shrinking, not growing. Clamp toward zero on whichever side the
    // row sits, so a reversal can never overshoot the row it belongs to or flip
    // its sign.
    const capped =
      t.amount >= 0
        ? Math.min(t.amount, Math.max(0, grossBack))
        : Math.max(t.amount, Math.min(0, grossBack));
    const reversedNet = isFullyRefunded ? t.amount : capped;
    const refundState =
      reversedNet === 0
        ? ("none" as const)
        : Math.abs(reversedNet) >= Math.abs(t.amount)
          ? ("full" as const)
          : ("partial" as const);
    return { ...t, refundState, reversedNet };
  });

  return { orgRefundGross, externalRefundGross, isFullyRefunded, paymentTransactions };
}
