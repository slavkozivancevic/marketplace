import { platformFeeAmount } from "@/features/payments/config";
import { getVariantLabel } from "@/features/attributes/utils/translations";
import { deriveSellerPartStage, sellerPartRefundState, type OrderStatusValue, type PaymentStatusValue } from "./status";
import { sellerOrderMoney } from "./sellerOrderMoney";
import { orgOrderActions } from "./orgOrderActions";
import { orgLedger } from "./orgLedger";

/**
 * What the received-order detail page will draw, handed from the list row the
 * seller clicked to the route's skeleton (`setRouteShape` / `readRouteShape`).
 *
 * Which cards that page has depends on the order: a COD order still waiting on
 * the seller opens with an "Action required" card, a shipped one swaps the
 * tracking form for its shipping details and gains a payment-history card, a
 * coupon adds a summary row. A skeleton that guesses one layout is wrong for
 * every other, and the page jumps the moment it lands. So the list - which has
 * the order - works it out with the same functions the page uses
 * (`buildOrgOrderDetailShape` below, called by the list query) and the
 * skeleton only draws.
 *
 * Plain data only, and the buyer's fields keep the names they have on an order
 * (`user.name`, `shippingLine1` ...), so `demoSafeOrder` masks them here exactly
 * as it masks the page.
 */
export type OrgOrderLedgerRowShape = {
  type: string;
  provider: string;
  amount: number;
  currency: string;
  status: string;
  createdAt: string;
  refundState: "none" | "partial" | "full";
  reversedNet: number;
};

export type OrgOrderDetailShape = {
  createdAt: string;
  paymentMethod: "STRIPE" | "COD";
  currency: string;
  /** This seller's stage - the status badge. */
  stage: OrderStatusValue;
  refundPartial: boolean;
  hasActiveReturn: boolean;
  /** Set only when the order carries a discount - the summary's coupon row. */
  couponCode: string | null;
  canManage: boolean;
  /** `OrgOrderStatusManager`'s two buttons; neither -> no card. */
  action: { paymentReceived: boolean; cancel: boolean };
  /** The shipping card, or null when the page does not render it. */
  shipment: {
    shippedAt: string | null;
    deliveredAt: string | null;
    carrier: string | null;
    trackingNumber: string | null;
  } | null;
  /** Returns this seller has on the order (the returns card). */
  returnsCount: number;
  ledger: OrgOrderLedgerRowShape[];
  /** One entry per line: whether it has a second (variant / SKU) line. */
  items: { subline: boolean }[];
  isCod: boolean;
  isCancelled: boolean;
  discountAmount: number;
  orgSubtotal: number;
  orgShipping: number;
  part: { itemsSubtotal: number; discountShare: number; shippingAmount: number; codSettled: boolean };
  money: {
    externalRefundPending: number;
    orgPayout: number;
    codCashToCollect: number;
    codCommissionCredited: number;
    codOwedAfterRefunds: number;
    payoutReversed: number;
    codNetted: number;
    payoutReversedFromTransfer: number;
    codDebtRestored: number;
    finalTransferred: number;
    platformFee: number;
  };
  user: { name: string | null };
  shippingName: string | null;
  shippingLine1: string | null;
  shippingLine2: string | null;
  shippingCity: string | null;
  shippingState: string | null;
  shippingPostalCode: string | null;
  shippingCountry: string | null;
};

export function orgOrderShapeKey(orderId: string): string {
  return `org-order:${orderId}`;
}

/**
 * The received-order detail page's layout for one list row - see
 * `OrgOrderDetailShape`. Every condition is the page's own, computed with the
 * same functions (`orgLedger`, `sellerOrderMoney`, `deriveSellerPartStage`,
 * `orgOrderActions`), so the skeleton draws the cards the page will. Pure, so a
 * unit test can walk it through every state.
 */
export function buildOrgOrderDetailShape({
  order,
  part,
  txns,
  organizationId,
  orgSubtotal,
  hasActiveReturn,
  returnsCount,
  canManage,
}: {
  order: {
    createdAt: Date;
    paymentMethod: "STRIPE" | "COD";
    paymentStatus: PaymentStatusValue;
    currency: string;
    locale: string;
    discountAmount: number;
    couponCode: string | null;
    shippingByOrg: unknown;
    user: { name: string | null };
    shippingName: string | null;
    shippingLine1: string | null;
    shippingLine2: string | null;
    shippingCity: string | null;
    shippingState: string | null;
    shippingPostalCode: string | null;
    shippingCountry: string | null;
    items: {
      variant: Parameters<typeof getVariantLabel>[0] & { sku: string | null } | null;
    }[];
  };
  part: {
    shippedAt: Date | null;
    deliveredAt: Date | null;
    cancelledAt: Date | null;
    codSettledAt: Date | null;
    itemsSubtotal: number;
    discountShare: number;
    shippingAmount: number;
    carrier: string | null;
    trackingNumber: string | null;
  };
  txns: {
    type: string;
    status: string;
    provider: string;
    amount: number;
    currency: string;
    createdAt: Date;
    organizationId: string | null;
  }[];
  organizationId: string;
  orgSubtotal: number;
  hasActiveReturn: boolean;
  returnsCount: number;
  canManage: boolean;
}): OrgOrderDetailShape {
  const ledger = orgLedger(txns, organizationId, order.paymentStatus, part);
  const orgRefund = { refundedGross: ledger.orgRefundGross, itemsSubtotal: part.itemsSubtotal };
  const isCod = order.paymentMethod === "COD";
  const isCancelled = part.cancelledAt != null;
  const isTerminal = isCancelled || order.paymentStatus === "REFUNDED";
  const orgShipping = (order.shippingByOrg as Record<string, number> | null)?.[organizationId] ?? 0;
  const payoutTx = ledger.paymentTransactions.find(
    (t) => t.type === "PAYOUT" && t.organizationId === organizationId && t.status === "SUCCEEDED",
  );
  const money = sellerOrderMoney({
    isCod,
    isCancelled,
    isFullyRefunded: ledger.isFullyRefunded,
    orgSubtotal,
    orgShipping,
    partShipping: part.shippingAmount,
    part,
    orgRefundGross: ledger.orgRefundGross,
    externalRefundGross: ledger.externalRefundGross,
    payoutTxAmount: payoutTx?.amount ?? null,
  });
  const iso = (d: Date | null) => (d ? d.toISOString() : null);

  return {
    createdAt: order.createdAt.toISOString(),
    paymentMethod: order.paymentMethod,
    currency: order.currency,
    stage: deriveSellerPartStage({
      part,
      paymentMethod: order.paymentMethod,
      orderPaymentStatus: order.paymentStatus,
      orgRefund,
    }),
    refundPartial: sellerPartRefundState(orgRefund, order.paymentStatus) === "partial",
    hasActiveReturn,
    couponCode: order.discountAmount > 0 ? (order.couponCode ?? "") : null,
    canManage,
    action: canManage
      ? orgOrderActions({
          paymentMethod: order.paymentMethod,
          orderPaymentStatus: order.paymentStatus,
          partDelivered: part.deliveredAt != null,
          partSettled: part.codSettledAt != null,
          partCancelled: isCancelled,
        })
      : { paymentReceived: false, cancel: false },
    shipment:
      canManage && !isTerminal
        ? {
            shippedAt: iso(part.shippedAt),
            deliveredAt: iso(part.deliveredAt),
            carrier: part.carrier,
            trackingNumber: part.trackingNumber,
          }
        : null,
    returnsCount: canManage ? returnsCount : 0,
    ledger: ledger.paymentTransactions.map((t) => ({
      type: t.type,
      provider: t.provider,
      amount: t.amount,
      currency: t.currency,
      status: t.status,
      createdAt: t.createdAt.toISOString(),
      refundState: t.refundState,
      reversedNet: t.reversedNet,
    })),
    items: order.items.map((item) => ({
      subline: getVariantLabel(item.variant, order.locale) != null || !!item.variant?.sku,
    })),
    isCod,
    isCancelled,
    discountAmount: order.discountAmount,
    orgSubtotal,
    orgShipping,
    part: {
      itemsSubtotal: part.itemsSubtotal,
      discountShare: part.discountShare,
      shippingAmount: part.shippingAmount,
      codSettled: part.codSettledAt != null,
    },
    money: {
      externalRefundPending: money.externalRefundPending,
      orgPayout: money.orgPayout,
      codCashToCollect: money.codCashToCollect,
      codCommissionCredited: money.codCommissionCredited,
      codOwedAfterRefunds: money.codOwedAfterRefunds,
      payoutReversed: money.payoutReversed,
      codNetted: money.codNetted,
      payoutReversedFromTransfer: money.payoutReversedFromTransfer,
      codDebtRestored: money.codDebtRestored,
      finalTransferred: money.finalTransferred,
      platformFee: platformFeeAmount(orgSubtotal),
    },
    user: { name: order.user.name },
    shippingName: order.shippingName,
    shippingLine1: order.shippingLine1,
    shippingLine2: order.shippingLine2,
    shippingCity: order.shippingCity,
    shippingState: order.shippingState,
    shippingPostalCode: order.shippingPostalCode,
    shippingCountry: order.shippingCountry,
  };
}
