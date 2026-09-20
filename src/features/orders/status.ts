// Pure, dependency-free order-status logic. Uses string-literal unions (not the
// generated Prisma enums) so it is safe to import from client components too -
// Prisma's enums are string-valued, so enum-typed values pass straight through.

export type PaymentStatusValue = "UNPAID" | "PAID" | "PARTIALLY_REFUNDED" | "REFUNDED";
export type FulfillmentStatusValue =
  | "UNFULFILLED"
  | "PARTIALLY_FULFILLED"
  | "FULFILLED"
  | "DELIVERED";
export type OrderStatusValue =
  | "PENDING"
  | "PROCESSING"
  | "SHIPPED"
  | "DELIVERED"
  | "COMPLETED"
  | "CANCELLED"
  | "REFUNDED"
  // Legacy values kept so old rows still type-check; never produced by derive.
  | "PENDING_COD"
  | "AWAITING_PAYMENT";

export type OrderAxes = {
  paymentStatus: PaymentStatusValue;
  fulfillmentStatus: FulfillmentStatusValue;
  cancelledAt: Date | null;
};

/**
 * Derives the overall display stage from the two real axes. The stored `status`
 * column is kept in sync with this so lists/filters can query one column, but
 * the UI should prefer deriving from the axes so legacy rows render correctly.
 *
 * COMPLETED means paid AND delivered. PROCESSING means paid but not shipped -
 * which is where a card order sits right after payment.
 */
export function deriveOrderStatus({
  paymentStatus,
  fulfillmentStatus,
  cancelledAt,
}: OrderAxes): OrderStatusValue {
  if (cancelledAt) return "CANCELLED";
  if (paymentStatus === "REFUNDED") return "REFUNDED";
  // A partially-refunded order is still an active, paid order for staging
  // purposes (the partial refund is surfaced separately).
  const paid = paymentStatus === "PAID" || paymentStatus === "PARTIALLY_REFUNDED";
  if (paid && fulfillmentStatus === "DELIVERED") return "COMPLETED";
  if (fulfillmentStatus === "DELIVERED") return "DELIVERED";
  if (fulfillmentStatus === "FULFILLED" || fulfillmentStatus === "PARTIALLY_FULFILLED") {
    return "SHIPPED";
  }
  if (paid) return "PROCESSING";
  return "PENDING";
}

/**
 * Fulfillment axis from per-seller progress:
 *   - no shipments        -> UNFULFILLED
 *   - every seller shipped + every seller delivered -> DELIVERED
 *   - every seller shipped (not all delivered)      -> FULFILLED
 *   - some but not all shipped                       -> PARTIALLY_FULFILLED
 *
 * The counts must cover only the parts that are still active. A cancelled part
 * left in `totalSellers` would hold the order below DELIVERED forever, and a COD
 * order that can never reach DELIVERED can never be collected.
 */
export function computeFulfillment(
  shippedSellers: number,
  totalSellers: number,
  deliveredSellers: number,
): FulfillmentStatusValue {
  if (shippedSellers <= 0) return "UNFULFILLED";
  if (deliveredSellers >= totalSellers) return "DELIVERED";
  if (shippedSellers >= totalSellers) return "FULFILLED";
  return "PARTIALLY_FULFILLED";
}

// ─── Per-seller part (sub-order) ─────────────────────────────────────────────

export type SellerPartStatusValue = "PENDING" | "SHIPPED" | "DELIVERED" | "CANCELLED";

/**
 * One seller's timestamps within an order. Same shape as OrderSellerPart, kept
 * structural so this file stays importable from client components.
 */
export type SellerPartAxes = {
  shippedAt: Date | null;
  deliveredAt: Date | null;
  cancelledAt: Date | null;
  codSettledAt: Date | null;
};

/**
 * A part's display stage, derived from its timestamps the way the order's own
 * `status` is derived from its axes. CANCELLED wins over everything: a COD buyer
 * can refuse the goods at the door, so a part can be cancelled after delivery.
 */
export function deriveSellerPartStatus({
  shippedAt,
  deliveredAt,
  cancelledAt,
}: Pick<SellerPartAxes, "shippedAt" | "deliveredAt" | "cancelledAt">): SellerPartStatusValue {
  if (cancelledAt) return "CANCELLED";
  if (deliveredAt) return "DELIVERED";
  if (shippedAt) return "SHIPPED";
  return "PENDING";
}

/** What this seller's own goods have had refunded, and what they were worth. */
export type SellerPartRefund = {
  /** Gross of THIS seller's goods refunded on this order, from its REFUND rows. */
  refundedGross: number;
  /** The part's goods at checkout - the bar that means "all of it came back". */
  itemsSubtotal: number;
};

/**
 * How refunded this seller's own part is: none, some of it, or all of it.
 *
 * Read from the seller's own REFUND rows, never from the order's payment axis.
 * That axis is a fact about the whole order, and in a multi-seller order it says
 * nothing about any one of them: it told a seller whose every unit had come back
 * that they were only PARTIALLY refunded, and - worse - told a seller who had
 * had no return at all the same thing, because somebody else's goods went back.
 * A seller is never shown another seller's state.
 *
 * The one case where the order does decide is a full refund. Whatever caused it,
 * `reverseSellerPayoutsForOrder` claws back every seller's transfer, so every
 * part really is refunded - including one refunded from the Stripe dashboard,
 * which carries no seller to attribute it to.
 */
export function sellerPartRefundState(
  orgRefund: SellerPartRefund,
  orderPaymentStatus: PaymentStatusValue,
): "none" | "partial" | "full" {
  if (orderPaymentStatus === "REFUNDED") return "full";
  if (orgRefund.refundedGross <= 0) return "none";
  return orgRefund.refundedGross >= orgRefund.itemsSubtotal ? "full" : "partial";
}

/**
 * The stage to show a SELLER for its own part of an order. Same vocabulary as
 * the order's display status, so the badges and filters are unchanged - but read
 * from this seller's part, not from the whole order.
 *
 * The money axis differs by rail. COD cash is collected per seller, so this
 * seller is paid once IT has settled, whatever the others are still doing. Card
 * money is captured for the whole order up front, so a seller with no refund of
 * its own is simply paid - the order's axis is NOT passed through, because in a
 * multi-seller order it carries other sellers' refunds (see
 * {@link sellerPartRefundState}).
 */
export function deriveSellerPartStage({
  part,
  paymentMethod,
  orderPaymentStatus,
  orgRefund,
}: {
  part: SellerPartAxes;
  paymentMethod: "STRIPE" | "COD";
  orderPaymentStatus: PaymentStatusValue;
  orgRefund: SellerPartRefund;
}): OrderStatusValue {
  const refundState = sellerPartRefundState(orgRefund, orderPaymentStatus);

  const paymentStatus: PaymentStatusValue =
    refundState === "full"
      ? "REFUNDED"
      : refundState === "partial"
        ? "PARTIALLY_REFUNDED"
        : paymentMethod === "COD"
          ? part.codSettledAt
            ? "PAID"
            : "UNPAID"
          : orderPaymentStatus === "UNPAID"
            ? "UNPAID"
            : "PAID";

  return deriveOrderStatus({
    paymentStatus,
    fulfillmentStatus: part.deliveredAt
      ? "DELIVERED"
      : part.shippedAt
        ? "FULFILLED"
        : "UNFULFILLED",
    cancelledAt: part.cancelledAt,
  });
}

/**
 * Rolls the seller parts up into the order's own state. This is the whole rule
 * for how a multi-seller order behaves when one seller drops out:
 *
 *   - cancelled parts are excluded from every aggregate
 *   - the order itself is cancelled only when NO active part is left
 *   - a COD order is paid only once every active part has confirmed its cash
 *
 * `fulfillmentStatus` is null when nothing is active, meaning "leave the axis
 * alone". The order is cancelled at that point and `deriveOrderStatus` reads
 * `cancelledAt` first, so recomputing a goods axis from an empty set would only
 * throw away the record of how far the order actually got.
 */
export function aggregateSellerParts(parts: SellerPartAxes[]): {
  fulfillmentStatus: FulfillmentStatusValue | null;
  allCancelled: boolean;
  codFullySettled: boolean;
} {
  const active = parts.filter((p) => p.cancelledAt == null);

  if (active.length === 0) {
    return { fulfillmentStatus: null, allCancelled: parts.length > 0, codFullySettled: false };
  }

  return {
    fulfillmentStatus: computeFulfillment(
      active.filter((p) => p.shippedAt != null).length,
      active.length,
      active.filter((p) => p.deliveredAt != null).length,
    ),
    allCancelled: false,
    codFullySettled: active.every((p) => p.codSettledAt != null),
  };
}
