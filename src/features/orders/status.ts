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
 * Fulfillment axis from per-seller shipment progress:
 *   - no shipments        -> UNFULFILLED
 *   - every seller shipped + every seller delivered -> DELIVERED
 *   - every seller shipped (not all delivered)      -> FULFILLED
 *   - some but not all shipped                       -> PARTIALLY_FULFILLED
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
