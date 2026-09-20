"use server";
import { logger } from "@/lib/logger";

import { prisma } from "@/core/db/prisma";
import { resolveRequestContext } from "@/lib/auth/resolveRequestContext";
import { requirePermission } from "@/lib/auth/permissions";
import {
  PaymentStatus,
  PaymentTransactionType,
  PaymentTransactionStatus,
  PaymentMethod,
} from "@/generated/prisma/client";
import { ForbiddenError } from "@/features/common/errors/domainErrors";
import {
  getSellerPart,
  syncCodCharge,
  syncOrderFromParts,
  updateSellerPart,
} from "@/features/orders/db/sellerParts";
import { platformFeeAmount } from "@/features/payments/config";
import { recordAudit } from "@/features/audit/db/audit";
import { releaseCouponUsage } from "@/features/coupons/db/coupons";
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
 * Confirms THIS seller collected the cash for its own delivered part of a COD
 * order, and accrues the platform commission it now owes on that part.
 *
 * Scoped to the seller's part on purpose. It used to act on the whole order,
 * which in a multi-seller order let one seller mark every other seller's cash as
 * received and saddle them with a FEE for money they had never seen. The order
 * itself reaches PAID only once every active part is settled - `syncOrderFromParts`
 * decides that, and only then is the order-level COD charge closed, so an order
 * is still never COMPLETED while any of it is unpaid.
 */
export async function markCodPaymentReceived(
  orderId: string,
): Promise<OrgOrderActionResult> {
  const auth = await authorize();
  if ("error" in auth) return auth;
  const { ctx } = auth;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      userId: true,
      locale: true,
      currency: true,
      paymentMethod: true,
      paymentStatus: true,
    },
  });
  if (!order) return { error: "Order not found" };

  // Ownership FIRST, before anything about the order's own state. A seller with
  // no part in this order must learn nothing from asking: answering "Not a COD
  // order" or "Order is already paid" told a caller holding a stray id what
  // somebody else's order is and how far along it is. The lookup used to be
  // scoped to the org, so the distinction did not exist.
  const part = await getSellerPart(orderId, ctx.organizationId);
  if (!part) return { error: "Order not found" };

  if (order.paymentMethod !== PaymentMethod.COD) return { error: "Not a COD order" };
  // Belt and braces. An order only leaves UNPAID once every active part has
  // settled, so the per-part guard below already covers this - but stating it
  // here means a second FEE can never be accrued against a closed order, even if
  // that derivation ever changes.
  if (order.paymentStatus !== PaymentStatus.UNPAID) {
    return { error: "Order is already paid" };
  }

  if (part.cancelledAt) return { error: "Your part of this order is cancelled" };
  if (part.codSettledAt) return { error: "Your part is already settled" };
  // Per-seller: this seller collects once IT has delivered, not once every other
  // seller in the order has.
  if (!part.deliveredAt) {
    return { error: "Your part must be delivered before payment is confirmed" };
  }

  // What the platform is owed for this part, AFTER its own share of the buyer's
  // coupon.
  //
  // The seller took the cash at the door, and that cash was already short by
  // `discountShare` - the order total the buyer pays is
  // `itemsSubtotal - discountShare + shippingAmount` per part (syncOrderFromParts).
  // Charging the full commission on the gross would therefore make the SELLER
  // fund the coupon, which is the opposite of what the platform promises them in
  // black and white ("the discount comes out of our commission, not your
  // payout"). Netting it here leaves the seller with exactly
  // `itemsSubtotal - fee + shippingAmount`, the same as a card order.
  //
  // It can go negative: a coupon steeper than the commission means the platform
  // owes the seller the difference. That is a real liability and it is recorded
  // as one - a negative running balance, paid out with the next Stripe transfer
  // (releaseSellerPayout) - rather than quietly floored at zero, which would put
  // the seller back to funding the discount in exactly the cases where it hurts
  // most.
  const grossFee = platformFeeAmount(part.itemsSubtotal);
  const fee = grossFee - part.discountShare;
  let orderFullyPaid = false;

  await prisma.$transaction(async (tx) => {
    await updateSellerPart(tx, part.id, { codSettledAt: new Date() });

    // Accrue the platform commission THIS seller now owes. It collected the cash
    // itself, so the fee can't be netted from a transfer (as it is for card
    // orders) - record it as a FEE owed by this org alone. A negative amount is
    // the platform owing the seller, and reads that way in the ledger.
    if (fee !== 0) {
      await tx.paymentTransaction.create({
        data: {
          orderId,
          organizationId: ctx.organizationId,
          type: PaymentTransactionType.FEE,
          status: PaymentTransactionStatus.SUCCEEDED,
          provider: PaymentMethod.COD,
          amount: fee,
          currency: order.currency,
          note:
            part.discountShare > 0
              ? `Commission ${grossFee} less coupon share ${part.discountShare} funded by the platform`
              : undefined,
        },
      });
      // Track this owed fee in the org's running balance so it can later be
      // netted against a same-currency Stripe payout (releaseSellerPayout) or
      // settled manually - individual FEE rows are per-order and never summed
      // on their own.
      await tx.orgBalance.upsert({
        where: {
          organizationId_currency: {
            organizationId: ctx.organizationId,
            currency: order.currency,
          },
        },
        create: {
          organizationId: ctx.organizationId,
          currency: order.currency,
          owedAmount: fee,
        },
        update: { owedAmount: { increment: fee } },
      });
    }

    const synced = await syncOrderFromParts(orderId, tx);

    // Closes the order-level cash charge only when there is nothing left to
    // collect from anyone.
    await syncCodCharge(tx, orderId, synced);

    orderFullyPaid = synced.paymentStatus === PaymentStatus.PAID;
  });

  revalidateOrderCache(order.userId, orderId);
  await recordAudit({
    action: "order.cod_paid",
    entityType: "Order",
    entityId: orderId,
    diff: { seller: ctx.organizationId, fee },
  });

  // The buyer's receipt is for the order, so it waits until the last seller has
  // been paid - otherwise a three-seller order would send three of them.
  if (orderFullyPaid) {
    try {
      await publishCodPaymentReceived(orderId, order.locale ?? "en");
    } catch (err) {
      logger.error(`[markCodPaymentReceived] notification failed for ${orderId}:`, err);
    }
  }

  return { success: true };
}

/**
 * Cancels THIS seller's part of an order before money changes hands, restocking
 * its own items. COD-only in practice: a paid (card) order must be refunded, not
 * cancelled, and a card order is paid the moment it exists.
 *
 * The buyer's order survives one seller withdrawing. It is cancelled, and its
 * coupon slot released, only once no active part is left. Until then the order
 * stays open with a smaller total, and the pending cash charge is reduced to
 * match so the courier collects only for goods that are still coming.
 */
export async function cancelOrder(
  orderId: string,
): Promise<OrgOrderActionResult> {
  const auth = await authorize();
  if ("error" in auth) return auth;
  const { ctx } = auth;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      userId: true,
      locale: true,
      couponId: true,
      paymentStatus: true,
      // Only THIS seller's lines. The restock below must never reach into
      // another seller's inventory.
      items: {
        where: { product: { organizationId: ctx.organizationId } },
        select: { productId: true, variantId: true, quantity: true },
      },
    },
  });
  if (!order) return { error: "Order not found" };

  // Ownership first - see markCodPaymentReceived. A caller with no part here
  // learns only that there is nothing of theirs at this id.
  const part = await getSellerPart(orderId, ctx.organizationId);
  if (!part) return { error: "Order not found" };

  if (order.paymentStatus !== PaymentStatus.UNPAID) {
    return { error: "Paid orders must be refunded, not cancelled" };
  }
  if (part.cancelledAt) return { error: "Your part of this order is already cancelled" };
  // The order-level UNPAID check above is not enough on its own: a seller that
  // has already collected its own cash sits inside an order that stays UNPAID
  // until the LAST seller collects. Cancelling then would restock goods that
  // were handed over and paid for, and leave the commission accrued against it.
  if (part.codSettledAt) {
    return { error: "You have already collected payment for your part" };
  }

  let orderCancelled = false;

  await prisma.$transaction(async (tx) => {
    await updateSellerPart(tx, part.id, { cancelledAt: new Date() });

    // Return reserved inventory (null stock = unlimited, leave it). These are
    // this seller's items only - see the scoped `items` query above.
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

    // Recompute the order's axes and what is still owed on it.
    const synced = await syncOrderFromParts(orderId, tx);
    orderCancelled = synced.orderCancelled;

    // The courier must never collect for goods that are no longer coming, and
    // this withdrawal can itself be what finishes the order - if the only other
    // seller had already collected its cash, the order is paid in full now.
    await syncCodCharge(tx, orderId, synced);
  });

  // Give the coupon slot back before any invalidation runs (the stock above is
  // restored in the transaction; this counter lives on the Coupon row, so it
  // cannot join it without locking an unrelated row for every cancellation).
  // Ahead of the cache calls deliberately - nothing that cannot be recomputed
  // may sit behind one.
  //
  // Only when the WHOLE order is gone. One seller dropping out leaves an order
  // that still exists and still used the code, so the slot stays spent. The
  // per-user limit needs no equivalent - it counts the buyer's non-cancelled
  // orders live, and this order is still one of them.
  if (orderCancelled && order.couponId) await releaseCouponUsage(order.couponId);

  revalidateOrderCache(order.userId, orderId);
  const productIds = [...new Set(order.items.map((i) => i.productId))];
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, organizationId: true },
  });
  products.forEach((p) => revalidateProductCache(p.organizationId, p.id));
  await recordAudit({
    action: "order.cancelled",
    entityType: "Order",
    entityId: orderId,
    diff: { seller: ctx.organizationId, orderCancelled },
  });

  try {
    await publishCodOrderCancelled(orderId, ctx.organizationId, order.locale ?? "en");
  } catch (err) {
    logger.error(`[cancelOrder] notification failed for ${orderId}:`, err);
  }

  return { success: true };
}
