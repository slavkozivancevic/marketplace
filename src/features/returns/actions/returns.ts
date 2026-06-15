"use server";

import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/core/db/prisma";
import { resolveRequestContext } from "@/lib/auth/resolveRequestContext";
import { requirePermission } from "@/lib/auth/permissions";
import {
  handleActionError,
  UnauthenticatedError,
  NotFoundError,
} from "@/features/common/errors/domainErrors";
import { createReturn, transitionReturn, type ReturnItemSelection } from "../db/returns";
import { ReturnStatus } from "@/generated/prisma/client";
import type { ActionErrorResult } from "@/types/types";

type Ok = { ok: true };

async function requireUserId(): Promise<string> {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) throw new UnauthenticatedError();
  const user = await prisma.user.findUnique({
    where: { clerkUserId },
    select: { id: true },
  });
  if (!user) throw new NotFoundError("User not found");
  return user.id;
}

/** Buyer opens a return for selected items from one seller's share of an order. */
export async function requestReturn(
  orderId: string,
  organizationId: string,
  items: ReturnItemSelection[],
  reason?: string,
): Promise<{ id: string } | ActionErrorResult> {
  try {
    const userId = await requireUserId();
    return await createReturn({ orderId, organizationId, userId, reason, items });
  } catch (e) {
    return handleActionError(e);
  }
}

/** Buyer marks the approved return as shipped back. */
export async function shipReturn(returnId: string): Promise<Ok | ActionErrorResult> {
  try {
    const userId = await requireUserId();
    await transitionReturn({
      returnId,
      to: ReturnStatus.SHIPPED,
      actor: "buyer",
      actorUserId: userId,
    });
    return { ok: true };
  } catch (e) {
    return handleActionError(e);
  }
}

async function sellerTransition(returnId: string, to: ReturnStatus, note?: string) {
  const ctx = await resolveRequestContext();
  requirePermission(ctx, "order:manage");
  await transitionReturn({
    returnId,
    to,
    actor: "seller",
    actorUserId: ctx.userId,
    actorOrgId: ctx.organizationId,
    note,
  });
}

/** Seller approves a requested return. */
export async function approveReturn(returnId: string): Promise<Ok | ActionErrorResult> {
  try {
    await sellerTransition(returnId, ReturnStatus.APPROVED);
    return { ok: true };
  } catch (e) {
    return handleActionError(e);
  }
}

/** Seller rejects a requested return (with a reason). */
export async function rejectReturn(
  returnId: string,
  note?: string,
): Promise<Ok | ActionErrorResult> {
  try {
    await sellerTransition(returnId, ReturnStatus.REJECTED, note);
    return { ok: true };
  } catch (e) {
    return handleActionError(e);
  }
}

/** Seller confirms receipt and refunds the buyer (executes the money side). */
export async function refundReturn(returnId: string): Promise<Ok | ActionErrorResult> {
  try {
    await sellerTransition(returnId, ReturnStatus.REFUNDED);
    return { ok: true };
  } catch (e) {
    return handleActionError(e);
  }
}
