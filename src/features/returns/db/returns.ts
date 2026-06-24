import { prisma } from "@/core/db/prisma";
import { stripe } from "@/services/stripe";
import {
  ReturnStatus,
  PaymentStatus,
  PaymentMethod,
  PaymentTransactionType,
  PaymentTransactionStatus,
} from "@/generated/prisma/client";
import { NotFoundError, ForbiddenError } from "@/features/common/errors/domainErrors";
import { MOCK_CONNECT } from "@/features/payments/mock";
import { sellerNetAmount } from "@/features/payments/config";
import { deriveOrderStatus } from "@/features/orders/status";
import { recordAudit } from "@/features/audit/db/audit";
import { revalidateOrderCache } from "@/features/orders/db/cache";
import { revalidateProductCache } from "@/features/products/db/cache";
import { getLabel } from "@/features/attributes/utils/translations";
import { getEmailThumbUrl } from "@/services/emailThumb";
import {
  publishReturnRequested,
  publishReturnApproved,
  publishReturnRejected,
  publishReturnShipped,
  publishReturnRefunded,
} from "@/services/notifications";

export type ReturnActor = "buyer" | "seller";

/** Allowed status transitions and which side may perform each. */
const TRANSITIONS: Record<ReturnStatus, { to: ReturnStatus; by: ReturnActor }[]> = {
  REQUESTED: [
    { to: ReturnStatus.APPROVED, by: "seller" },
    { to: ReturnStatus.REJECTED, by: "seller" },
  ],
  APPROVED: [{ to: ReturnStatus.SHIPPED, by: "buyer" }],
  SHIPPED: [{ to: ReturnStatus.REFUNDED, by: "seller" }],
  REJECTED: [],
  REFUNDED: [],
};

export type ReturnItemSelection = { orderItemId: string; quantity: number };

/**
 * Resolves a return's lines to `{ name, quantity, imageUrl }` for email
 * notifications. Names are localized in the order's locale (a snapshot, matching
 * how order emails render item names), with the variant label appended. The
 * image is an email-renderable JPEG (variant image, else product image).
 */
async function getReturnLines(
  returnId: string,
  locale: string,
): Promise<{ name: string; quantity: number; price: number; imageUrl: string | null }[]> {
  const mediaSelect = { url: true, thumbUrl: true, key: true, thumbKey: true } as const;
  const items = await prisma.returnItem.findMany({
    where: { returnId },
    select: {
      quantity: true,
      orderItem: {
        select: {
          price: true,
          product: {
            select: {
              translations: { select: { locale: true, title: true } },
              media: {
                orderBy: { order: "asc" },
                take: 1,
                where: { mediaType: "IMAGE" },
                select: mediaSelect,
              },
            },
          },
          variant: {
            select: {
              media: {
                orderBy: { order: "asc" },
                take: 1,
                select: { media: { select: mediaSelect } },
              },
              attributeValues: {
                select: {
                  option: { select: { translations: { select: { locale: true, label: true } } } },
                },
              },
            },
          },
        },
      },
    },
  });
  return Promise.all(
    items.map(async (ri) => {
      const title =
        ri.orderItem.product.translations.find((t) => t.locale === locale)?.title ??
        ri.orderItem.product.translations.find((t) => t.locale === "en")?.title ??
        "";
      const variantLabel = ri.orderItem.variant?.attributeValues
        .map((av) => getLabel(av.option.translations, locale))
        .join(" / ");
      const src = ri.orderItem.variant?.media[0]?.media ?? ri.orderItem.product.media[0] ?? null;
      const imageUrl = src
        ? await getEmailThumbUrl(src.key, src.thumbKey, src.thumbUrl ?? src.url)
        : null;
      return {
        name: variantLabel ? `${title} (${variantLabel})` : title,
        quantity: ri.quantity,
        price: ri.orderItem.price,
        imageUrl,
      };
    }),
  );
}

/** Returns the org's gross subtotal + line items within an order (fallback). */
async function orgPortionOfOrder(orderId: string, organizationId: string) {
  const items = await prisma.orderItem.findMany({
    where: { orderId, product: { organizationId } },
    select: { productId: true, variantId: true, quantity: true, price: true },
  });
  const subtotal = items.reduce((s, it) => s + it.price * it.quantity, 0);
  return { items, subtotal };
}

/**
 * Units already returned per order item, across every non-rejected return. A
 * rejected return frees its units back up. `ordered - returned` is the quantity
 * still eligible for a new return.
 */
export async function getReturnedQuantities(
  orderId: string,
): Promise<Record<string, number>> {
  const rows = await prisma.returnItem.findMany({
    where: { return: { orderId, status: { not: ReturnStatus.REJECTED } } },
    select: { orderItemId: true, quantity: true },
  });
  const out: Record<string, number> = {};
  for (const r of rows) out[r.orderItemId] = (out[r.orderItemId] ?? 0) + r.quantity;
  return out;
}

/**
 * Buyer opens a partial return for selected items/quantities from one seller's
 * share of an order. Guards: order is the buyer's, paid by card and COMPLETED;
 * each selected item belongs to that seller in the order; and no quantity may
 * exceed what is still returnable (ordered minus already-returned).
 */
export async function createReturn({
  orderId,
  organizationId,
  userId,
  reason,
  items,
}: {
  orderId: string;
  organizationId: string;
  userId: string;
  reason?: string;
  items: ReturnItemSelection[];
}) {
  if (items.length === 0) throw new ForbiddenError({ key: "returnNoItems" });

  const order = await prisma.order.findFirst({
    where: { id: orderId, userId },
    select: { id: true, paymentStatus: true, paymentMethod: true, locale: true },
  });
  if (!order) throw new NotFoundError("Order not found");
  // The order must have collected money that can be returned. (Card is paid at
  // capture; COD only once the seller confirms cash received.) A partially
  // refunded order still has returnable items left.
  if (
    order.paymentStatus !== PaymentStatus.PAID &&
    order.paymentStatus !== PaymentStatus.PARTIALLY_REFUNDED
  ) {
    throw new ForbiddenError({ key: "returnNotEligible" });
  }
  // ...and the buyer can only return goods they have actually received. So this
  // seller's shipment must be marked DELIVERED - shipped-but-in-transit is not
  // yet returnable (the buyer doesn't have the items).
  const shipment = await prisma.shipment.findUnique({
    where: { orderId_organizationId: { orderId, organizationId } },
    select: { deliveredAt: true },
  });
  if (!shipment?.deliveredAt) throw new ForbiddenError({ key: "returnNotShipped" });

  // The seller's order items (id -> ordered quantity) - bounds the selection.
  const orgItems = await prisma.orderItem.findMany({
    where: { orderId, product: { organizationId } },
    select: { id: true, quantity: true },
  });
  const orderedById = new Map(orgItems.map((i) => [i.id, i.quantity]));
  const returned = await getReturnedQuantities(orderId);

  for (const sel of items) {
    const ordered = orderedById.get(sel.orderItemId);
    if (ordered === undefined) throw new ForbiddenError({ key: "returnInvalidItem" });
    if (!Number.isInteger(sel.quantity) || sel.quantity < 1) {
      throw new ForbiddenError({ key: "returnInvalidQuantity" });
    }
    const remaining = ordered - (returned[sel.orderItemId] ?? 0);
    if (sel.quantity > remaining) throw new ForbiddenError({ key: "returnExceedsQuantity" });
  }

  const created = await prisma.$transaction(async (tx) => {
    const r = await tx.return.create({
      data: { orderId, organizationId, userId, reason: reason || null },
      select: { id: true },
    });
    await tx.returnItem.createMany({
      data: items.map((i) => ({
        returnId: r.id,
        orderItemId: i.orderItemId,
        quantity: i.quantity,
      })),
    });
    return r;
  });
  revalidateOrderCache(userId, orderId);
  await recordAudit({
    action: "return.requested",
    entityType: "Return",
    entityId: created.id,
    diff: { orderId, seller: organizationId },
  });

  // Notify the seller (fire-and-forget - email failure must not block the return).
  const lines = await getReturnLines(created.id, order.locale);
  publishReturnRequested({
    returnId: created.id,
    orderId,
    organizationId,
    locale: order.locale,
    reason: reason || undefined,
    items: lines,
  }).catch((err) => console.error("[returns] publishReturnRequested failed", err));

  return created;
}

/**
 * Money side of a refunded return: partial Stripe refund to the buyer for the
 * seller's subtotal, restock that seller's items, reverse the seller's transfer
 * (clawback), and write a REFUND ledger row. Mock mode skips every Stripe call.
 * Runs inside the REFUNDED transition.
 */
async function settleReturnRefund(
  returnId: string,
  organizationId: string,
  orderId: string,
): Promise<number> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      userId: true,
      currency: true,
      total: true,
      discountAmount: true,
      paymentMethod: true,
      fulfillmentStatus: true,
      cancelledAt: true,
    },
  });
  if (!order) throw new NotFoundError("Order not found");
  const isStripe = order.paymentMethod === PaymentMethod.STRIPE;

  // Can't refund money that was never collected. The order's CHARGE must be
  // settled (SUCCEEDED) first: for card that's true at capture; for COD the
  // seller must confirm "payment received" before a refund. Keeps the ledger
  // consistent - a REFUND always follows a SUCCEEDED CHARGE.
  const paidCharge = await prisma.paymentTransaction.findFirst({
    where: {
      orderId,
      type: PaymentTransactionType.CHARGE,
      status: PaymentTransactionStatus.SUCCEEDED,
    },
    select: { id: true },
  });
  if (!paidCharge) {
    throw new ForbiddenError({ key: "returnRefundBeforePayment" });
  }

  // Refund exactly the units on this return. Legacy returns (created before the
  // per-item model) have no ReturnItem rows - fall back to the whole org portion.
  const retItems = await prisma.returnItem.findMany({
    where: { returnId },
    select: {
      quantity: true,
      orderItem: { select: { productId: true, variantId: true, price: true } },
    },
  });
  const lines =
    retItems.length > 0
      ? retItems.map((ri) => ({
          productId: ri.orderItem.productId,
          variantId: ri.orderItem.variantId,
          quantity: ri.quantity,
          price: ri.orderItem.price,
        }))
      : (await orgPortionOfOrder(orderId, organizationId)).items;

  // Gross subtotal of the returned units. The seller was paid on the full gross
  // (platform-funded coupon model), so the clawback and the REFUND ledger row
  // stay on this number - that's what the payout/payment-history views net.
  const refundAmount = lines.reduce((s, l) => s + l.price * l.quantity, 0);
  if (refundAmount <= 0) throw new NotFoundError("Nothing to refund");

  // What the BUYER actually gets back. With a platform-funded coupon the buyer
  // only paid (gross - discount), so refunding the full gross would exceed the
  // captured amount (Stripe rejects it) and over-count toward "fully refunded".
  // Scale the buyer refund to their paid share; cumulative proportional rounding
  // makes the per-return refunds sum to exactly order.total once all is returned.
  const orderGross = order.total + order.discountAmount;
  const priorAgg = await prisma.paymentTransaction.aggregate({
    where: { orderId, type: PaymentTransactionType.REFUND },
    _sum: { amount: true },
  });
  const priorRefundedGross = priorAgg._sum.amount ?? 0;
  const grossToPaid = (gross: number) =>
    order.discountAmount > 0 && orderGross > 0
      ? Math.round((gross * order.total) / orderGross)
      : gross;
  const buyerRefund = Math.max(
    0,
    grossToPaid(priorRefundedGross + refundAmount) - grossToPaid(priorRefundedGross),
  );

  // Refund handling differs by payment method: card refunds go back through
  // Stripe; COD "refunds" are cash returned out of band, recorded for audit.
  let refundProvider: PaymentMethod = PaymentMethod.COD;
  let refundProviderId: string | null = null;

  if (isStripe) {
    refundProvider = PaymentMethod.STRIPE;

    const charge = await prisma.paymentTransaction.findFirst({
      where: { orderId, type: PaymentTransactionType.CHARGE, provider: PaymentMethod.STRIPE },
      select: { providerId: true },
    });
    const payout = await prisma.paymentTransaction.findFirst({
      where: {
        orderId,
        organizationId,
        type: PaymentTransactionType.PAYOUT,
        status: PaymentTransactionStatus.SUCCEEDED,
      },
      select: { providerId: true },
    });

    const mock = MOCK_CONNECT || !charge?.providerId || charge.providerId.startsWith("seed_pi_");

    // Refund the buyer what they paid for the returned units (gross less their
    // share of the platform-funded discount).
    if (!mock && charge?.providerId && buyerRefund > 0) {
      const refund = await stripe.refunds.create({
        payment_intent: charge.providerId,
        amount: buyerRefund,
      });
      refundProviderId = refund.id;
    } else {
      refundProviderId = `re_mock_${returnId}`;
    }

    // Reverse the seller's NET share of the refunded amount (they only ever
    // received subtotal minus the platform fee). Skip for mock transfers.
    const realTransfer =
      payout?.providerId && !MOCK_CONNECT && !payout.providerId.startsWith("tr_mock_");
    if (realTransfer && payout?.providerId) {
      try {
        await stripe.transfers.createReversal(payout.providerId, {
          amount: sellerNetAmount(refundAmount),
        });
      } catch (err) {
        console.error("[settleReturnRefund] transfer reversal failed", err);
      }
    }
  }

  await prisma.$transaction(async (tx) => {
    // Restock the returned units.
    for (const it of lines) {
      if (it.variantId) {
        await tx.productVariant.update({
          where: { id: it.variantId },
          data: { stock: { increment: it.quantity } },
        });
      } else {
        const prod = await tx.product.findUnique({
          where: { id: it.productId },
          select: { stock: true },
        });
        if (prod?.stock !== null && prod?.stock !== undefined) {
          await tx.product.update({
            where: { id: it.productId },
            data: { stock: { increment: it.quantity } },
          });
        }
      }
    }

    // Ledger: buyer-facing REFUND, scoped to the seller org.
    await tx.paymentTransaction.create({
      data: {
        orderId,
        organizationId,
        type: PaymentTransactionType.REFUND,
        status: PaymentTransactionStatus.SUCCEEDED,
        provider: refundProvider,
        providerId: refundProviderId,
        amount: refundAmount,
        currency: order.currency,
      },
    });

    await tx.return.update({
      where: { id: returnId },
      // Buyer-facing: store what the buyer actually got back (discounted), so the
      // order page / email match the money returned, not the gross.
      data: { status: ReturnStatus.REFUNDED, refundAmount: buyerRefund },
    });

    // Move the payment axis: fully REFUNDED once cumulative refunds cover the
    // order's gross subtotal (the ledger rows are gross), otherwise
    // PARTIALLY_REFUNDED. Recompute the derived display status.
    const agg = await tx.paymentTransaction.aggregate({
      where: { orderId, type: PaymentTransactionType.REFUND },
      _sum: { amount: true },
    });
    const refundedTotal = agg._sum.amount ?? 0;
    const nextPayment =
      refundedTotal >= orderGross ? PaymentStatus.REFUNDED : PaymentStatus.PARTIALLY_REFUNDED;
    await tx.order.update({
      where: { id: orderId },
      data: {
        paymentStatus: nextPayment,
        status: deriveOrderStatus({
          paymentStatus: nextPayment,
          fulfillmentStatus: order.fulfillmentStatus,
          cancelledAt: order.cancelledAt,
        }),
      },
    });
  });

  revalidateOrderCache(order.userId, orderId);
  const productIds = [...new Set(lines.map((i) => i.productId))];
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, organizationId: true },
  });
  products.forEach((p) => revalidateProductCache(p.organizationId, p.id));

  // Return the buyer-facing amount so the "return refunded" email shows what the
  // buyer actually received.
  return buyerRefund;
}

/**
 * Advances a return to `to`, enforcing the status machine and which side may do
 * it. `actorOrgId` is required for seller actions (must own the return's org);
 * `actorUserId` for buyer actions (must own the return's order).
 */
export async function transitionReturn({
  returnId,
  to,
  actor,
  actorUserId,
  actorOrgId,
  note,
}: {
  returnId: string;
  to: ReturnStatus;
  actor: ReturnActor;
  actorUserId: string;
  actorOrgId?: string;
  note?: string;
}) {
  const ret = await prisma.return.findUnique({
    where: { id: returnId },
    select: {
      id: true,
      orderId: true,
      organizationId: true,
      userId: true,
      status: true,
      order: { select: { locale: true, paymentMethod: true } },
    },
  });
  if (!ret) throw new NotFoundError("Return not found");

  if (actor === "buyer" && ret.userId !== actorUserId) throw new ForbiddenError();
  if (actor === "seller" && ret.organizationId !== actorOrgId) throw new ForbiddenError();

  const allowed = TRANSITIONS[ret.status].some((t) => t.to === to && t.by === actor);
  if (!allowed) throw new ForbiddenError({ key: "returnInvalidTransition" });

  const locale = ret.order.locale;
  // Returned lines for the email body - fetched before refund deletes nothing
  // (ReturnItems persist) so it is safe to read at any transition.
  const lines = await getReturnLines(returnId, locale);
  const base = {
    returnId,
    orderId: ret.orderId,
    organizationId: ret.organizationId,
    locale,
    items: lines,
  };

  if (to === ReturnStatus.REFUNDED) {
    const refundAmount = await settleReturnRefund(returnId, ret.organizationId, ret.orderId);
    if (note) {
      await prisma.return.update({ where: { id: returnId }, data: { resolutionNote: note } });
    }
    publishReturnRefunded({
      ...base,
      refundAmount,
      cod: ret.order.paymentMethod === PaymentMethod.COD,
    }).catch((err) => console.error("[returns] publishReturnRefunded failed", err));
  } else {
    await prisma.return.update({
      where: { id: returnId },
      data: { status: to, ...(note !== undefined ? { resolutionNote: note } : {}) },
    });

    // Fire-and-forget notifications - email failure must not block the action.
    if (to === ReturnStatus.APPROVED) {
      publishReturnApproved(base).catch((err) =>
        console.error("[returns] publishReturnApproved failed", err),
      );
    } else if (to === ReturnStatus.REJECTED) {
      publishReturnRejected({ ...base, note }).catch((err) =>
        console.error("[returns] publishReturnRejected failed", err),
      );
    } else if (to === ReturnStatus.SHIPPED) {
      publishReturnShipped(base).catch((err) =>
        console.error("[returns] publishReturnShipped failed", err),
      );
    }
  }

  revalidateOrderCache(ret.userId, ret.orderId);
  await recordAudit({
    action: `return.${to.toLowerCase()}`,
    entityType: "Return",
    entityId: returnId,
    diff: { orderId: ret.orderId, status: { from: ret.status, to } },
  });
  return { id: returnId, status: to };
}

/** Returns for an order, for the buyer's order page (all sellers, with lines). */
export function getOrderReturns(orderId: string) {
  return prisma.return.findMany({
    where: { orderId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      organizationId: true,
      status: true,
      reason: true,
      resolutionNote: true,
      refundAmount: true,
      createdAt: true,
      items: { select: { orderItemId: true, quantity: true } },
    },
  });
}

/** Returns for one seller within an order (for the org order page, with lines). */
export function getOrgOrderReturns(orderId: string, organizationId: string) {
  return prisma.return.findMany({
    where: { orderId, organizationId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      reason: true,
      resolutionNote: true,
      refundAmount: true,
      createdAt: true,
      items: { select: { orderItemId: true, quantity: true } },
    },
  });
}
