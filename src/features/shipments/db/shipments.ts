import { logger } from "@/lib/logger";
import { prisma } from "@/core/db/prisma";
import { FulfillmentStatus, PaymentStatus, PaymentMethod } from "@/generated/prisma/client";
import { NotFoundError, ForbiddenError } from "@/features/common/errors/domainErrors";
import { revalidateOrderCache } from "@/features/orders/db/cache";
import { syncOrderFromParts, updateSellerPart } from "@/features/orders/db/sellerParts";
import { releaseSellerPayout } from "@/features/payments/db/payouts";
import { recordAudit } from "@/features/audit/db/audit";
import {
  publishOrderShipped,
  publishOrderTrackingUpdated,
  publishCodOrderFulfilled,
  publishOrderDelivered,
} from "@/services/notifications";

/**
 * Loads this seller's part of an order and checks it may still be worked on.
 * Both the order and the part have to be live: a refunded order is closed for
 * everyone, and a seller that cancelled its own part cannot go on shipping it.
 */
async function loadWorkablePart(orderId: string, organizationId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      userId: true,
      locale: true,
      paymentMethod: true,
      paymentStatus: true,
      cancelledAt: true,
    },
  });
  if (!order) throw new NotFoundError("Order not found");

  // Scoped to this seller's part - never to "the order has an item of mine".
  const part = await prisma.orderSellerPart.findUnique({
    where: { orderId_organizationId: { orderId, organizationId } },
    select: {
      id: true,
      shippedAt: true,
      deliveredAt: true,
      cancelledAt: true,
      trackingNumber: true,
      carrier: true,
    },
  });
  if (!part) throw new NotFoundError("Order not found");

  if (part.cancelledAt || order.paymentStatus === PaymentStatus.REFUNDED) {
    throw new ForbiddenError({ key: "shipmentNotAllowed" });
  }

  return { order, part };
}

/**
 * Seller marks its own part of an order as shipped, optionally with a tracking
 * number + carrier. Re-marking only updates the tracking. Notifies the buyer.
 */
export async function createShipment({
  orderId,
  organizationId,
  trackingNumber,
  carrier,
}: {
  orderId: string;
  organizationId: string;
  trackingNumber?: string;
  carrier?: string;
}) {
  const { order, part } = await loadWorkablePart(orderId, organizationId);

  // First ship vs a later tracking edit - only the former is a fulfillment event.
  const alreadyShipped = part.shippedAt != null;
  const nextTracking = trackingNumber || null;
  const nextCarrier = carrier || null;
  const numberChanged = nextTracking !== part.trackingNumber;
  const carrierChanged = nextCarrier !== part.carrier;
  // What the buyer holds is a pair: a number, and the carrier to type it into.
  // News is any edit that makes that pair stale or finally usable.
  //
  //   number added / replaced / withdrawn    always news, whatever the carrier did
  //   number stands, carrier moved to a
  //     different one or named for the
  //     first time                           news - the number is fine but the
  //                                          place to use it is not
  //   number stands, carrier cleared         silent: nothing the buyer was told
  //                                          stopped being true, the number still
  //                                          works where it always did
  //   no number at all, carrier anything     silent: nothing to look up
  //   same values saved again                silent: not a change
  const trackingIsNews =
    alreadyShipped &&
    (numberChanged || (nextTracking != null && nextCarrier != null && carrierChanged));

  const written = await updateSellerPart(prisma, part.id, {
    shippedAt: alreadyShipped ? part.shippedAt : new Date(),
    trackingNumber: trackingNumber || null,
    carrier: carrier || null,
  });

  // Roll this seller's progress up into the order's own axes.
  await syncOrderFromParts(orderId);

  // Audit the fulfillment milestone (not noisy tracking edits).
  if (!alreadyShipped) {
    await recordAudit({
      action: "order.shipped",
      entityType: "Order",
      entityId: orderId,
      diff: { seller: organizationId, carrier: carrier || null, tracking: trackingNumber || null },
    });
  }

  // Release this seller's held payout now that it has fulfilled (card orders
  // only; idempotent). Best-effort - a transfer hiccup must not block shipping.
  try {
    await releaseSellerPayout({ orderId, organizationId });
  } catch (err) {
    logger.error("[shipments] releaseSellerPayout failed", err);
  }

  revalidateOrderCache(order.userId, orderId);

  // Notify the buyer (fire-and-forget - email failure must not block fulfillment).
  // The shipped email goes out once, on the first ship. Later edits either carry
  // a tracking number the buyer has not seen (its own, quieter email) or nothing
  // worth an email at all. Re-publishing `order.shipped` here used to be harmless
  // only because the downstream idempotency record swallowed it - and that record
  // expires, so a late edit could re-announce a long-delivered shipment.
  if (!alreadyShipped) {
    publishOrderShipped({
      shipmentId: part.id,
      orderId,
      organizationId,
      locale: order.locale,
      trackingNumber: trackingNumber || undefined,
      carrier: carrier || undefined,
    }).catch((err) => logger.error("[shipments] publishOrderShipped failed", err));
  } else if (trackingIsNews) {
    publishOrderTrackingUpdated({
      shipmentId: part.id,
      orderId,
      organizationId,
      locale: order.locale,
      // Both halves, before and after. How they moved is what the email says.
      trackingNumber: nextTracking ?? undefined,
      carrier: nextCarrier ?? undefined,
      previousTrackingNumber: part.trackingNumber ?? undefined,
      previousCarrier: part.carrier ?? undefined,
      // Identifies this edit. Two edits that land on the same pair of values are
      // two pieces of news, not one - see publishOrderTrackingUpdated.
      writtenAt: written.updatedAt,
    }).catch((err) => logger.error("[shipments] publishOrderTrackingUpdated failed", err));
  }

  return { id: part.id };
}

/**
 * Seller confirms its own part was delivered. Requires that it has shipped. The
 * order reaches DELIVERED only once every part that is still active has been
 * delivered - a cancelled part is not waited on. When that makes a COD order
 * fully delivered, notifies the buyer that cash is now due.
 */
export async function markShipmentDelivered({
  orderId,
  organizationId,
}: {
  orderId: string;
  organizationId: string;
}) {
  const { order, part } = await loadWorkablePart(orderId, organizationId);

  if (!part.shippedAt) throw new ForbiddenError({ key: "shipmentNotShippedYet" });

  if (!part.deliveredAt) {
    await updateSellerPart(prisma, part.id, { deliveredAt: new Date() });
    await recordAudit({
      action: "order.delivered",
      entityType: "Order",
      entityId: orderId,
      diff: { seller: organizationId },
    });
  }

  const { fulfillmentStatus } = await syncOrderFromParts(orderId);
  revalidateOrderCache(order.userId, orderId);

  // Notify the buyer once the WHOLE order is delivered. COD gets the "cash now
  // due" email; a card order gets a plain delivery confirmation.
  if (fulfillmentStatus === FulfillmentStatus.DELIVERED) {
    try {
      if (order.paymentMethod === PaymentMethod.COD) {
        await publishCodOrderFulfilled(orderId, order.locale ?? "en");
      } else {
        await publishOrderDelivered(orderId, order.locale ?? "en");
      }
    } catch (err) {
      logger.error("[shipments] delivery notification failed", err);
    }
  }

  return { id: part.id, fulfillmentStatus };
}

/**
 * Every seller part of an order (buyer-side grouping by seller). Includes
 * cancelled parts: the buyer is owed the fact that one seller dropped out, not
 * a silently shorter list.
 */
export function getOrderSellerParts(orderId: string) {
  return prisma.orderSellerPart.findMany({
    where: { orderId },
    select: {
      id: true,
      organizationId: true,
      status: true,
      trackingNumber: true,
      carrier: true,
      shippedAt: true,
      deliveredAt: true,
      cancelledAt: true,
    },
  });
}

/** This seller's part of an order, if any (org order page). */
export function getOrgShipment(orderId: string, organizationId: string) {
  return prisma.orderSellerPart.findUnique({
    where: { orderId_organizationId: { orderId, organizationId } },
    select: {
      id: true,
      status: true,
      trackingNumber: true,
      carrier: true,
      shippedAt: true,
      deliveredAt: true,
      cancelledAt: true,
      codSettledAt: true,
      // The part's own money snapshot. The seller order page spells the COD cash
      // out of it (goods less this part's coupon share, plus its delivery) -
      // the same three figures the order total is rebuilt from, so the courier's
      // number and the buyer's can never drift apart.
      itemsSubtotal: true,
      shippingAmount: true,
      discountShare: true,
    },
  });
}
