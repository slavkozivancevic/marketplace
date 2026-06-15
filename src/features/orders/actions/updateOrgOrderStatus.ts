"use server";

import { prisma } from "@/core/db/prisma";
import { resolveRequestContext } from "@/lib/auth/resolveRequestContext";
import { requirePermission } from "@/lib/auth/permissions";
import { OrderStatus, PaymentTransactionType, PaymentTransactionStatus, PaymentMethod } from "@/generated/prisma/client";
import { ForbiddenError } from "@/features/common/errors/domainErrors";
import {
  publishCodOrderFulfilled,
  publishCodOrderCancelled,
  publishCodPaymentReceived,
} from "@/services/notifications";
import { revalidateOrderCache } from "@/features/orders/db/cache";
import { revalidateProductCache } from "@/features/products/db/cache";

// Valid transitions a seller can make on their org's COD orders. COMPLETED is
// reached only via markCodPaymentReceived (payment confirmed), never directly -
// an order must be paid before it is complete.
const ALLOWED_TRANSITIONS: Partial<Record<OrderStatus, OrderStatus[]>> = {
  PENDING_COD: [OrderStatus.AWAITING_PAYMENT, OrderStatus.CANCELLED],
  AWAITING_PAYMENT: [OrderStatus.CANCELLED],
};

export type UpdateOrgOrderStatusResult =
  | { success: true; newStatus: OrderStatus }
  | { error: string };

export async function updateOrgOrderStatus(
  orderId: string,
  newStatus: string,
): Promise<UpdateOrgOrderStatusResult> {
  if (!Object.values(OrderStatus).includes(newStatus as OrderStatus)) {
    return { error: "Invalid status" };
  }
  let ctx;
  try {
    ctx = await resolveRequestContext();
  } catch {
    return { error: "Unauthorized" };
  }

  // OWNER and ADMIN membership roles can manage orders; MEMBER is read-only
  try {
    requirePermission(ctx, "order:manage");
  } catch (e) {
    if (e instanceof ForbiddenError) return { error: "Forbidden" };
    throw e;
  }

  // Fetch the order and verify it belongs to this org
  const order = await prisma.order.findFirst({
    where: {
      id: orderId,
      items: { some: { product: { organizationId: ctx.organizationId } } },
    },
    select: {
      id: true,
      status: true,
      locale: true,
      userId: true,
      items: { select: { productId: true, variantId: true, quantity: true } },
    },
  });

  if (!order) {
    return { error: "Order not found" };
  }

  // Validate the requested status transition
  const typedStatus = newStatus as OrderStatus;
  const allowed = ALLOWED_TRANSITIONS[order.status] ?? [];
  if (!allowed.includes(typedStatus)) {
    return {
      error: `Cannot transition from ${order.status} to ${newStatus}`,
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: orderId },
      data: { status: typedStatus },
    });

    // Delivery (AWAITING_PAYMENT) does not mean the seller has the cash yet, so
    // the COD charge stays PENDING until payment is confirmed separately
    // (markCodPaymentReceived).
    if (typedStatus === OrderStatus.CANCELLED) {
      // A cancelled order is never paid - fail its charge.
      await tx.paymentTransaction.updateMany({
        where: {
          orderId,
          type: PaymentTransactionType.CHARGE,
          provider: PaymentMethod.COD,
        },
        data: { status: PaymentTransactionStatus.FAILED },
      });

      // Return reserved inventory. Cancel is only reachable from PENDING_COD /
      // AWAITING_PAYMENT (never after a refund), so no item was restocked yet -
      // no double-restock risk. Null stock = unlimited, leave it.
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
    }
  });

  revalidateOrderCache(order.userId, orderId);
  if (typedStatus === OrderStatus.CANCELLED) {
    const productIds = [...new Set(order.items.map((i) => i.productId))];
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, organizationId: true },
    });
    products.forEach((p) => revalidateProductCache(p.organizationId, p.id));
  }

  // Fire notification - best-effort (don't fail the action if SNS is down)
  try {
    if (typedStatus === OrderStatus.AWAITING_PAYMENT) {
      await publishCodOrderFulfilled(orderId, order.locale ?? "en");
    } else if (typedStatus === OrderStatus.CANCELLED) {
      await publishCodOrderCancelled(orderId, order.locale ?? "en");
    }
  } catch (err) {
    console.error(`[updateOrgOrderStatus] failed to publish notification for order ${orderId}:`, err);
  }

  return { success: true, newStatus: typedStatus };
}

export type MarkCodPaidResult = { success: true } | { error: string };

/**
 * Confirms the seller received the cash for a delivered COD order. This is what
 * completes the order: it moves AWAITING_PAYMENT -> COMPLETED and settles the
 * PENDING charge to SUCCEEDED in one transaction, so an order is never COMPLETED
 * while unpaid.
 */
export async function markCodPaymentReceived(
  orderId: string,
): Promise<MarkCodPaidResult> {
  let ctx;
  try {
    ctx = await resolveRequestContext();
  } catch {
    return { error: "Unauthorized" };
  }

  try {
    requirePermission(ctx, "order:manage");
  } catch (e) {
    if (e instanceof ForbiddenError) return { error: "Forbidden" };
    throw e;
  }

  const order = await prisma.order.findFirst({
    where: {
      id: orderId,
      items: { some: { product: { organizationId: ctx.organizationId } } },
    },
    select: { id: true, status: true, paymentMethod: true, userId: true, locale: true },
  });

  if (!order) return { error: "Order not found" };
  if (order.paymentMethod !== PaymentMethod.COD) {
    return { error: "Not a COD order" };
  }
  if (order.status !== OrderStatus.AWAITING_PAYMENT) {
    return { error: "Order is not awaiting payment" };
  }

  await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: orderId },
      data: { status: OrderStatus.COMPLETED },
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
  });

  revalidateOrderCache(order.userId, orderId);

  // Buyer-facing COD payment receipt - best-effort, must not fail the action.
  try {
    await publishCodPaymentReceived(orderId, order.locale ?? "en");
  } catch (err) {
    console.error(`[markCodPaymentReceived] failed to publish notification for order ${orderId}:`, err);
  }

  return { success: true };
}