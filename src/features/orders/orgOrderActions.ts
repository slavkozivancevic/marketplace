/**
 * Which money-step buttons a seller gets on its part of an order - the
 * "Action required" card (`OrgOrderStatusManager`). One rule, read by the card
 * and by the detail skeleton's shape, so the skeleton can never draw a card the
 * page then leaves out.
 *
 * Both halves are per-seller: collect the cash for YOUR items once YOU have
 * delivered them, and withdraw YOUR items while nothing is paid. Neither ever
 * reaches another seller's goods in the same order.
 */
export function orgOrderActions({
  paymentMethod,
  orderPaymentStatus,
  partDelivered,
  partSettled,
  partCancelled,
}: {
  paymentMethod: string;
  orderPaymentStatus: string;
  partDelivered: boolean;
  partSettled: boolean;
  partCancelled: boolean;
}): { paymentReceived: boolean; cancel: boolean } {
  const live = paymentMethod === "COD" && orderPaymentStatus === "UNPAID" && !partCancelled;
  return {
    paymentReceived: live && partDelivered && !partSettled,
    cancel: live && !partSettled,
  };
}
