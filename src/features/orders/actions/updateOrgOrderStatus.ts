"use server";

import { prisma } from "@/core/db/prisma";
import { resolveRequestContext } from "@/lib/auth/resolveRequestContext";
import { requirePermission } from "@/lib/auth/permissions";
import { OrderStatus } from "@/generated/prisma/client";
import { ForbiddenError } from "@/features/common/errors/domainErrors";
import {
  publishCodOrderFulfilled,
  publishCodOrderCancelled,
} from "@/services/notifications";
import { revalidateOrderCache } from "@/features/orders/db/cache";

// Valid transitions a seller can make on their org's orders
const ALLOWED_TRANSITIONS: Partial<Record<OrderStatus, OrderStatus[]>> = {
  PENDING_COD: [OrderStatus.COMPLETED, OrderStatus.CANCELLED],
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
    select: { id: true, status: true, locale: true, userId: true },
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

  await prisma.order.update({
    where: { id: orderId },
    data: { status: typedStatus },
  });

  revalidateOrderCache(order.userId, orderId);

  // Fire notification - best-effort (don't fail the action if SNS is down)
  try {
    if (typedStatus === OrderStatus.COMPLETED) {
      await publishCodOrderFulfilled(orderId, order.locale ?? "en");
    } else if (typedStatus === OrderStatus.CANCELLED) {
      await publishCodOrderCancelled(orderId, order.locale ?? "en");
    }
  } catch (err) {
    console.error(`[updateOrgOrderStatus] failed to publish notification for order ${orderId}:`, err);
  }

  return { success: true, newStatus: typedStatus };
}