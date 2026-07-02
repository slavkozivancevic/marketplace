"use server";
import { logger } from "@/lib/logger";

import { prisma } from "@/core/db/prisma";
import { resolveRequestContext } from "@/lib/auth/resolveRequestContext";
import { requirePermission } from "@/lib/auth/permissions";
import {
  FulfillmentStatus,
  PaymentStatus,
  PaymentTransactionType,
  PaymentTransactionStatus,
  PaymentMethod,
  OrderStatus,
} from "@/generated/prisma/client";
import { ForbiddenError } from "@/features/common/errors/domainErrors";
import { deriveOrderStatus } from "@/features/orders/status";
import { platformFeeAmount } from "@/features/payments/config";
import { recordAudit } from "@/features/audit/db/audit";
import {
  publishCodOrderCancelled,
  publishCodPaymentReceived,
} from "@/services/notifications";
import { revalidateOrderCache } from "@/features/orders/db/cache";
import { revalidateProductCache } from "@/features/products/db/cache";

export type OrgOrderActionResult = { success: true } | { error: string };

type AuthedOrder = {
  ctx: Awaited<ReturnType<typeof resolveRequestContext>>;
};

async function authorize(): Promise<AuthedOrder | { error: string }> {
  let ctx;
  try {
    ctx = await resolveRequestContext();
  } catch {
    return { error: "Unauthorized" };
  }
  // OWNER and ADMIN membership roles can manage orders; MEMBER is read-only.
  try {
    requirePermission(ctx, "order:manage");
  } catch (e) {
    if (e instanceof ForbiddenError) return { error: "Forbidden" };
    throw e;
  }
  return { ctx };
}

/**
 * Confirms the seller received the cash for a delivered COD order. This is what
 * completes a COD order: it sets paymentStatus PAID (derived COMPLETED) and
 * settles the PENDING charge to SUCCEEDED in one transaction, so an order is
 * never COMPLETED while unpaid.
 */
export async function markCodPaymentReceived(
  orderId: string,
): Promise<OrgOrderActionResult> {
  const auth = await authorize();
  if ("error" in auth) return auth;
  const { ctx } = auth;

  const order = await prisma.order.findFirst({
    where: { id: orderId, items: { some: { product: { organizationId: ctx.organizationId } } } },
    select: {
      id: true,
      userId: true,
      locale: true,
      currency: true,
      paymentMethod: true,
      paymentStatus: true,
      fulfillmentStatus: true,
      cancelledAt: true,
    },
  });
  if (!order) return { error: "Order not found" };
  if (order.paymentMethod !== PaymentMethod.COD) return { error: "Not a COD order" };
  if (order.cancelledAt) return { error: "Order is cancelled" };
  if (order.paymentStatus !== PaymentStatus.UNPAID) return { error: "Order is already paid" };
  if (order.fulfillmentStatus !== FulfillmentStatus.DELIVERED) {
    return { error: "Order must be delivered before payment is confirmed" };
  }

  await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: orderId },
      data: {
        paymentStatus: PaymentStatus.PAID,
        status: deriveOrderStatus({
          paymentStatus: PaymentStatus.PAID,
          fulfillmentStatus: order.fulfillmentStatus,
          cancelledAt: null,
        }),
      },
    });
    await tx.paymentTransaction.updateMany({
      where: {
        orderId,
        type: PaymentTransactionType.CHARGE,
        provider: PaymentMethod.COD,
        status: PaymentTransactionStatus.PENDING,
      },
      data: { status: PaymentTransactionStatus.SUCCEEDED },
    });

    // Accrue the platform commission each seller now owes on this COD order. The
    // seller collected the full cash, so the fee can't be netted from a transfer
    // (as it is for card orders) - record it as a FEE owed per seller.
    const orgItems = await tx.orderItem.findMany({
      where: { orderId },
      select: { price: true, quantity: true, product: { select: { organizationId: true } } },
    });
    const subtotalByOrg = new Map<string, number>();
    for (const it of orgItems) {
      const orgId = it.product.organizationId;
      subtotalByOrg.set(orgId, (subtotalByOrg.get(orgId) ?? 0) + it.price * it.quantity);
    }
    for (const [organizationId, subtotal] of subtotalByOrg) {
      const fee = platformFeeAmount(subtotal);
      if (fee <= 0) continue;
      await tx.paymentTransaction.create({
        data: {
          orderId,
          organizationId,
          type: PaymentTransactionType.FEE,
          status: PaymentTransactionStatus.SUCCEEDED,
          provider: PaymentMethod.COD,
          amount: fee,
          currency: order.currency,
        },
      });
    }
  });

  revalidateOrderCache(order.userId, orderId);
  await recordAudit({ action: "order.cod_paid", entityType: "Order", entityId: orderId });

  try {
    await publishCodPaymentReceived(orderId, order.locale ?? "en");
  } catch (err) {
    logger.error(`[markCodPaymentReceived] notification failed for ${orderId}:`, err);
  }

  return { success: true };
}

/**
 * Cancels an order before money changes hands. COD-only path: a paid (card)
 * order must be refunded, not cancelled. Sets cancelledAt (derived CANCELLED),
 * fails the pending COD charge and restocks the reserved inventory.
 */
export async function cancelOrder(
  orderId: string,
): Promise<OrgOrderActionResult> {
  const auth = await authorize();
  if ("error" in auth) return auth;
  const { ctx } = auth;

  const order = await prisma.order.findFirst({
    where: { id: orderId, items: { some: { product: { organizationId: ctx.organizationId } } } },
    select: {
      id: true,
      userId: true,
      locale: true,
      paymentStatus: true,
      cancelledAt: true,
      items: { select: { productId: true, variantId: true, quantity: true } },
    },
  });
  if (!order) return { error: "Order not found" };
  if (order.cancelledAt) return { error: "Order is already cancelled" };
  if (order.paymentStatus !== PaymentStatus.UNPAID) {
    return { error: "Paid orders must be refunded, not cancelled" };
  }

  await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: orderId },
      data: { cancelledAt: new Date(), status: OrderStatus.CANCELLED },
    });

    // A cancelled order is never paid - fail its pending COD charge.
    await tx.paymentTransaction.updateMany({
      where: { orderId, type: PaymentTransactionType.CHARGE, provider: PaymentMethod.COD },
      data: { status: PaymentTransactionStatus.FAILED },
    });

    // Return reserved inventory (null stock = unlimited, leave it).
    for (const item of order.items) {
      if (item.variantId) {
        await tx.productVariant.update({
          where: { id: item.variantId },
          data: { stock: { increment: item.quantity } },
        });
      } else {
        const product = await tx.product.findUnique({
          where: { id: item.productId },
          select: { stock: true },
        });
        if (product?.stock !== null && product?.stock !== undefined) {
          await tx.product.update({
            where: { id: item.productId },
            data: { stock: { increment: item.quantity } },
          });
        }
      }
    }
  });

  revalidateOrderCache(order.userId, orderId);
  const productIds = [...new Set(order.items.map((i) => i.productId))];
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, organizationId: true },
  });
  products.forEach((p) => revalidateProductCache(p.organizationId, p.id));
  await recordAudit({ action: "order.cancelled", entityType: "Order", entityId: orderId });

  try {
    await publishCodOrderCancelled(orderId, order.locale ?? "en");
  } catch (err) {
    logger.error(`[cancelOrder] notification failed for ${orderId}:`, err);
  }

  return { success: true };
}
