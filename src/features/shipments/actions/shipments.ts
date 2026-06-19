"use server";

import { resolveRequestContext } from "@/lib/auth/resolveRequestContext";
import { requirePermission } from "@/lib/auth/permissions";
import { handleActionError } from "@/features/common/errors/domainErrors";
import { createShipment, markShipmentDelivered } from "../db/shipments";
import type { ActionErrorResult } from "@/types/types";

type Ok = { ok: true };

/** Seller marks its items in an order as shipped, with optional tracking. */
export async function markShipped(
  orderId: string,
  trackingNumber?: string,
  carrier?: string,
): Promise<Ok | ActionErrorResult> {
  try {
    const ctx = await resolveRequestContext();
    requirePermission(ctx, "order:manage");
    await createShipment({
      orderId,
      organizationId: ctx.organizationId,
      trackingNumber: trackingNumber?.trim() || undefined,
      carrier: carrier?.trim() || undefined,
    });
    return { ok: true };
  } catch (e) {
    return handleActionError(e);
  }
}

/** Seller confirms its own shipment was delivered to the buyer. */
export async function markDelivered(
  orderId: string,
): Promise<Ok | ActionErrorResult> {
  try {
    const ctx = await resolveRequestContext();
    requirePermission(ctx, "order:manage");
    await markShipmentDelivered({ orderId, organizationId: ctx.organizationId });
    return { ok: true };
  } catch (e) {
    return handleActionError(e);
  }
}
