import { logger } from "@/lib/logger";
import { prisma } from "@/core/db/prisma";
import { FulfillmentStatus, PaymentStatus, PaymentMethod } from "@/generated/prisma/client";
import { NotFoundError, ForbiddenError } from "@/features/common/errors/domainErrors";
import { revalidateOrderCache } from "@/features/orders/db/cache";
import { computeFulfillment, deriveOrderStatus } from "@/features/orders/status";
import { releaseSellerPayout } from "@/features/payments/db/payouts";
import { recordAudit } from "@/features/audit/db/audit";
import {
  publishOrderShipped,
  publishCodOrderFulfilled,
  publishOrderDelivered,
} from "@/services/notifications";

/**
 * Recomputes an order's fulfillment axis from its shipments and writes both the
 * axis and the derived display status. Returns the new fulfillment value.
 */
async function syncOrderFulfillment(orderId: string): Promise<FulfillmentStatus> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      paymentStatus: true,
      cancelledAt: true,
      items: { select: { product: { select: { organizationId: true } } } },
      shipments: { select: { deliveredAt: true } },
    },
  });
  if (!order) throw new NotFoundError("Order not found");

  const totalSellers = new Set(order.items.map((i) => i.product.organizationId)).size;
  const shippedSellers = order.shipments.length;
  const deliveredSellers = order.shipments.filter((s) => s.deliveredAt != null).length;
  const fulfillmentStatus = computeFulfillment(shippedSellers, totalSellers, deliveredSellers);

  await prisma.order.update({
    where: { id: orderId },
    data: {
      fulfillmentStatus,
      status: deriveOrderStatus({
        paymentStatus: order.paymentStatus,
        fulfillmentStatus,
        cancelledAt: order.cancelledAt,
      }),
    },
  });
  return fulfillmentStatus;
}

/**
 * Seller marks its portion of an order as shipped (fulfilled), optionally with a
 * tracking number + carrier. One shipment per (order, seller); re-marking
 * updates the tracking. Notifies the buyer. Not allowed once the order is
 * cancelled or refunded.
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
  const order = await prisma.order.findFirst({
    where: { id: orderId, items: { some: { product: { organizationId } } } },
    select: { id: true, userId: true, locale: true, paymentStatus: true, cancelledAt: true },
  });
  if (!order) throw new NotFoundError("Order not found");
  if (order.cancelledAt || order.paymentStatus === PaymentStatus.REFUNDED) {
    throw new ForbiddenError({ key: "shipmentNotAllowed" });
  }

  // First ship vs a later tracking edit - only the former is a fulfillment event.
  const priorShipment = await prisma.shipment.findUnique({
    where: { orderId_organizationId: { orderId, organizationId } },
    select: { id: true },
  });

  const shipment = await prisma.shipment.upsert({
    where: { orderId_organizationId: { orderId, organizationId } },
    create: {
      orderId,
      organizationId,
      trackingNumber: trackingNumber || null,
      carrier: carrier || null,
    },
    update: {
      trackingNumber: trackingNumber || null,
      carrier: carrier || null,
      shippedAt: new Date(),
    },
    select: { id: true },
  });

  // Recompute the order's fulfillment axis from all seller shipments.
  await syncOrderFulfillment(orderId);

  // Audit the fulfillment milestone (not noisy tracking edits).
  if (!priorShipment) {
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
  publishOrderShipped({
    shipmentId: shipment.id,
    orderId,
    organizationId,
    locale: order.locale,
    trackingNumber: trackingNumber || undefined,
    carrier: carrier || undefined,
  }).catch((err) => logger.error("[shipments] publishOrderShipped failed", err));

  return shipment;
}

/**
 * Seller confirms its own shipment was delivered. Requires that this seller has
 * shipped. Recomputes the order's fulfillment axis (the order reaches DELIVERED
 * only once EVERY seller's shipment is delivered). When that makes a COD order
 * fully delivered, notifies the buyer that cash is now due.
 */
export async function markShipmentDelivered({
  orderId,
  organizationId,
}: {
  orderId: string;
  organizationId: string;
}) {
  const order = await prisma.order.findFirst({
    where: { id: orderId, items: { some: { product: { organizationId } } } },
    select: { id: true, userId: true, locale: true, paymentMethod: true, paymentStatus: true, cancelledAt: true },
  });
  if (!order) throw new NotFoundError("Order not found");
  if (order.cancelledAt || order.paymentStatus === PaymentStatus.REFUNDED) {
    throw new ForbiddenError({ key: "shipmentNotAllowed" });
  }

  const shipment = await prisma.shipment.findUnique({
    where: { orderId_organizationId: { orderId, organizationId } },
    select: { id: true, deliveredAt: true },
  });
  if (!shipment) throw new ForbiddenError({ key: "shipmentNotShippedYet" });

  if (!shipment.deliveredAt) {
    await prisma.shipment.update({
      where: { id: shipment.id },
      data: { deliveredAt: new Date() },
    });
    await recordAudit({
      action: "order.delivered",
      entityType: "Order",
      entityId: orderId,
      diff: { seller: organizationId },
    });
  }

  const fulfillmentStatus = await syncOrderFulfillment(orderId);
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

  return { id: shipment.id, fulfillmentStatus };
}

/** All shipments for an order (buyer-side grouping by seller). */
export function getOrderShipments(orderId: string) {
  return prisma.shipment.findMany({
    where: { orderId },
    select: {
      id: true,
      organizationId: true,
      trackingNumber: true,
      carrier: true,
      shippedAt: true,
      deliveredAt: true,
    },
  });
}

/** This seller's shipment for an order, if any (org order page). */
export function getOrgShipment(orderId: string, organizationId: string) {
  return prisma.shipment.findUnique({
    where: { orderId_organizationId: { orderId, organizationId } },
    select: { id: true, trackingNumber: true, carrier: true, shippedAt: true, deliveredAt: true },
  });
}
