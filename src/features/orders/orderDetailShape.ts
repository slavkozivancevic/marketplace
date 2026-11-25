import { getProductTitle } from "@/features/products/utils/translations";
import { getVariantLabel } from "@/features/attributes/utils/translations";
import { groupReturnSellers } from "@/features/returns/returnSellers";
import {
  deriveOrderStatus,
  type FulfillmentStatusValue,
  type OrderStatusValue,
  type PaymentStatusValue,
} from "./status";

/**
 * What the buyer's order detail page will draw, handed from the clicked list
 * row to the route's skeleton - the buyer-side twin of `OrgOrderDetailShape`.
 * Built by `buildOrderDetailShape` below from the same rules the page
 * uses (`groupReturnSellers`, the returns-card and totals conditions), so the
 * skeleton draws the page's own rows: a shipping line per seller, the returns
 * card with each seller's button or hint, every item (titles wrap here, so they
 * are carried as text), and the totals that apply.
 */
export type OrderReturnShape = {
  status: string;
  lines: { title: string; variantLabel: string | null; quantity: number }[];
  reason: string | null;
  resolutionNote: string | null;
};

export type OrderReturnSellerShape = {
  name: string;
  /** The "Request return" button. */
  button: boolean;
  /** Why there is no button, when the page says so. */
  hint: "sellerCancelledHint" | "returnAfterDelivery" | "windowExpiredHint" | "notEligibleHint" | null;
  daysLeft: number | null;
  returns: OrderReturnShape[];
};

export type OrderDetailShape = {
  createdAt: string;
  isCod: boolean;
  currency: string;
  stage: OrderStatusValue;
  partiallyRefunded: boolean;
  hasActiveReturn: boolean;
  invoiceable: boolean;
  sellers: {
    name: string;
    shippedAt: string | null;
    deliveredAt: string | null;
    cancelledAt: string | null;
    carrier: string | null;
    trackingNumber: string | null;
  }[];
  /** The returns card, or null when the page leaves it out. */
  returnSellers: OrderReturnSellerShape[] | null;
  /** Titles wrap on this page, beside the line total - so both are carried. */
  items: { title: string; variantLabel: string | null; cancelled: boolean; price: number; quantity: number }[];
  total: number;
  discountAmount: number;
  couponCode: string | null;
  shippingTotal: number;
  buyerRefunded: number;
  isCancelled: boolean;
  shippingName: string | null;
  shippingLine1: string | null;
  shippingLine2: string | null;
  shippingCity: string | null;
  shippingState: string | null;
  shippingPostalCode: string | null;
  shippingCountry: string | null;
};

export function orderShapeKey(orderId: string): string {
  return `order:${orderId}`;
}

/**
 * The buyer order detail page's layout for one list row - see
 * `OrderDetailShape`. Each condition is the page's own. Pure, so a unit test
 * can walk it through every state.
 */
export function buildOrderDetailShape({
  order,
  parts,
  returns,
  externalRefunded,
  hasActiveReturn,
}: {
  order: {
    createdAt: Date;
    paymentMethod: string;
    paymentStatus: PaymentStatusValue;
    fulfillmentStatus: FulfillmentStatusValue;
    cancelledAt: Date | null;
    currency: string;
    locale: string;
    total: number;
    discountAmount: number;
    couponCode: string | null;
    shippingTotal: number;
    shippingName: string | null;
    shippingLine1: string | null;
    shippingLine2: string | null;
    shippingCity: string | null;
    shippingState: string | null;
    shippingPostalCode: string | null;
    shippingCountry: string | null;
    items: {
      id: string;
      quantity: number;
      price: number;
      product: Parameters<typeof getProductTitle>[0] & {
        organizationId: string;
        organization: { name: string; returnWindowDays: number };
      };
      variant: Parameters<typeof getVariantLabel>[0];
    }[];
  };
  parts: {
    organizationId: string;
    shippedAt: Date | null;
    deliveredAt: Date | null;
    cancelledAt: Date | null;
    carrier: string | null;
    trackingNumber: string | null;
  }[];
  returns: {
    organizationId: string;
    status: string;
    reason: string | null;
    resolutionNote: string | null;
    refundAmount: number | null;
    items: { orderItemId: string; quantity: number }[];
  }[];
  externalRefunded: number;
  hasActiveReturn: boolean;
}): OrderDetailShape {
  const returnEligible =
    order.paymentStatus === "PAID" || order.paymentStatus === "PARTIALLY_REFUNDED";
  const info = new Map(
    order.items.map((it) => [
      it.id,
      { title: getProductTitle(it.product, order.locale), variantLabel: getVariantLabel(it.variant, order.locale) },
    ]),
  );
  // `getReturnedQuantities`: everything in a return that was not rejected.
  const returnedQty: Record<string, number> = {};
  for (const r of returns) {
    if (r.status === "REJECTED") continue;
    for (const ri of r.items) returnedQty[ri.orderItemId] = (returnedQty[ri.orderItemId] ?? 0) + ri.quantity;
  }
  const sellers = groupReturnSellers({
    items: order.items.map((it) => ({
      id: it.id,
      quantity: it.quantity,
      ...info.get(it.id)!,
      organizationId: it.product.organizationId,
      orgName: it.product.organization.name,
      returnWindowDays: it.product.organization.returnWindowDays,
    })),
    parts,
    returnEligible,
    returnedQty,
  });
  const partByOrg = new Map(parts.map((p) => [p.organizationId, p]));
  const iso = (d: Date | null) => (d ? d.toISOString() : null);
  const showReturns = returnEligible || returns.length > 0 || parts.some((p) => p.shippedAt != null);

  return {
    createdAt: order.createdAt.toISOString(),
    isCod: order.paymentMethod === "COD",
    currency: order.currency,
    stage: deriveOrderStatus({
      paymentStatus: order.paymentStatus,
      fulfillmentStatus: order.fulfillmentStatus,
      cancelledAt: order.cancelledAt,
    }),
    partiallyRefunded: order.paymentStatus === "PARTIALLY_REFUNDED",
    hasActiveReturn,
    invoiceable: order.paymentStatus !== "UNPAID",
    sellers: sellers.map((s) => {
      const part = partByOrg.get(s.organizationId);
      return {
        name: s.name,
        shippedAt: iso(part?.shippedAt ?? null),
        deliveredAt: iso(part?.deliveredAt ?? null),
        cancelledAt: iso(part?.cancelledAt ?? null),
        carrier: part?.carrier ?? null,
        trackingNumber: part?.trackingNumber ?? null,
      };
    }),
    returnSellers: showReturns
      ? sellers.map((s) => {
          const sellerReturns = returns.filter((r) => r.organizationId === s.organizationId);
          const returnable = s.items.filter((i) => i.returnable > 0).length > 0;
          return {
            name: s.name,
            button: s.canReturn && returnable,
            hint:
              !s.canReturn && returnable && sellerReturns.length === 0
                ? s.cancelled
                  ? ("sellerCancelledHint" as const)
                  : !s.delivered
                    ? ("returnAfterDelivery" as const)
                    : s.windowExpired
                      ? ("windowExpiredHint" as const)
                      : ("notEligibleHint" as const)
                : null,
            daysLeft: s.canReturn && returnable ? s.returnDaysLeft : null,
            returns: sellerReturns.map((r) => ({
              status: r.status,
              lines: r.items.map((ri) => ({
                title: info.get(ri.orderItemId)?.title ?? "",
                variantLabel: info.get(ri.orderItemId)?.variantLabel ?? null,
                quantity: ri.quantity,
              })),
              reason: r.reason,
              resolutionNote: r.status === "REJECTED" ? r.resolutionNote : null,
            })),
          };
        })
      : null,
    items: order.items.map((it) => ({
      ...info.get(it.id)!,
      cancelled: partByOrg.get(it.product.organizationId)?.cancelledAt != null,
      price: it.price,
      quantity: it.quantity,
    })),
    total: order.total,
    discountAmount: order.discountAmount,
    couponCode: order.couponCode,
    shippingTotal: order.shippingTotal,
    buyerRefunded:
      returns
        .filter((r) => r.status === "REFUNDED")
        .reduce((sum, r) => sum + (r.refundAmount ?? 0), 0) + externalRefunded,
    isCancelled: order.cancelledAt != null,
    shippingName: order.shippingName,
    shippingLine1: order.shippingLine1,
    shippingLine2: order.shippingLine2,
    shippingCity: order.shippingCity,
    shippingState: order.shippingState,
    shippingPostalCode: order.shippingPostalCode,
    shippingCountry: order.shippingCountry,
  };
}
