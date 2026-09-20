import { prisma, type TransactionClient } from "@/core/db/prisma";
import {
  PaymentMethod,
  PaymentStatus,
  PaymentTransactionStatus,
  PaymentTransactionType,
} from "@/generated/prisma/client";
import { NotFoundError } from "@/features/common/errors/domainErrors";
import { platformFeeSlice } from "@/features/payments/config";
import {
  aggregateSellerParts,
  deriveOrderStatus,
  deriveSellerPartStatus,
} from "@/features/orders/status";

/**
 * OrderSellerPart is the sub-order: one seller's share of a multi-seller order.
 * It is the unit a SELLER acts on, so shipping, cancelling and COD settlement
 * can never reach another seller's goods. The buyer still has a single Order,
 * whose own state is derived here by rolling the parts back up.
 */

export type SellerPartDraft = {
  organizationId: string;
  itemsSubtotal: number;
  shippingAmount: number;
  discountShare: number;
};

/**
 * Splits an order into one draft part per seller.
 *
 * The coupon discount is order-level, so each part takes a pro-rata slice by
 * items subtotal. Shares are floored and the rounding remainder goes to the
 * largest part (ties broken by organizationId, so the split is deterministic),
 * which keeps `sum(discountShare) === discountAmount` exactly - without that,
 * cancelling one part would leave the recomputed order total a cent or two off.
 *
 * Deliberately identical to the SQL in the `order_seller_part` migration: the
 * migration cannot import app code, so the two are separate implementations of
 * one rule and must be read together when either changes.
 */
export function buildSellerParts({
  items,
  shippingByOrg,
  discountAmount,
}: {
  items: { organizationId: string; price: number; quantity: number }[];
  shippingByOrg?: Record<string, number> | null;
  discountAmount: number;
}): SellerPartDraft[] {
  const subtotalByOrg = new Map<string, number>();
  for (const item of items) {
    const current = subtotalByOrg.get(item.organizationId) ?? 0;
    subtotalByOrg.set(item.organizationId, current + item.price * item.quantity);
  }

  // Largest first, then by id - the remainder below depends on this order.
  const ordered = [...subtotalByOrg.entries()].sort(
    ([aOrg, aSub], [bOrg, bSub]) => bSub - aSub || aOrg.localeCompare(bOrg),
  );

  const totalSubtotal = ordered.reduce((sum, [, subtotal]) => sum + subtotal, 0);

  const drafts = ordered.map(([organizationId, itemsSubtotal]) => ({
    organizationId,
    itemsSubtotal,
    shippingAmount: shippingByOrg?.[organizationId] ?? 0,
    discountShare:
      totalSubtotal > 0 ? Math.floor((discountAmount * itemsSubtotal) / totalSubtotal) : 0,
  }));

  const remainder = discountAmount - drafts.reduce((sum, d) => sum + d.discountShare, 0);
  if (remainder !== 0 && drafts.length > 0) {
    drafts[0].discountShare += remainder;
  }

  return drafts;
}

/** The coupon and goods a part carries - all `couponSliceAt` needs. */
export type PartCouponBasis = { itemsSubtotal: number; discountShare: number } | null;

/**
 * How much of this part's coupon share rides on `gross` worth of its goods.
 *
 * Taken from the PART, never re-derived from an order-level ratio: the coupon
 * was split across the parts once, at checkout, by a rule that floors each share
 * and hands the remainder to the largest (`buildSellerParts`), so the parts are
 * the only place that knows to the unit what each seller's goods were discounted
 * by. An order-level ratio agrees only when the split happened to divide evenly.
 *
 * Capped at the part's own goods: a caller must never be told that more coupon
 * came back than ever went out.
 */
export function couponSliceAt(gross: number, part: PartCouponBasis): number {
  const subtotal = part?.itemsSubtotal ?? 0;
  const discount = part?.discountShare ?? 0;
  if (discount <= 0 || subtotal <= 0) return 0;
  return Math.round((discount * Math.min(gross, subtotal)) / subtotal);
}

/**
 * What comes off a COD seller's balance when `gross` worth of their goods is
 * returned: the commission on those goods, less the coupon slice that rode on
 * them. The same shape `markCodPaymentReceived` accrued (`fee - discountShare`),
 * because anything else leaves the seller owing a commission on goods they no
 * longer hold. Can be negative - the platform's own credit shrinking - which is
 * a real state, not an error.
 *
 * `priorGross` is everything already returned for this (order, seller), so the
 * pieces telescope - see {@link platformFeeSlice}.
 */
export function codCommissionBack(
  priorGross: number,
  gross: number,
  part: PartCouponBasis,
): number {
  const couponBack = couponSliceAt(priorGross + gross, part) - couponSliceAt(priorGross, part);
  return platformFeeSlice(priorGross, gross) - couponBack;
}

/**
 * Creates an order's parts. Called inside the order-creation transaction so an
 * order never exists without them - the order's axes are aggregated from its
 * parts, so a partless order could never be fulfilled.
 */
export async function createSellerParts(
  tx: TransactionClient,
  orderId: string,
  drafts: SellerPartDraft[],
): Promise<void> {
  if (drafts.length === 0) return;
  await tx.orderSellerPart.createMany({
    data: drafts.map((draft) => ({ orderId, ...draft })),
  });
}

/** This seller's part of an order, or null if it has none (not their order). */
export function getSellerPart(orderId: string, organizationId: string) {
  return prisma.orderSellerPart.findUnique({
    where: { orderId_organizationId: { orderId, organizationId } },
  });
}

/** Same, but for call sites where a missing part means the caller has no business here. */
export async function requireSellerPart(orderId: string, organizationId: string) {
  const part = await getSellerPart(orderId, organizationId);
  if (!part) throw new NotFoundError("Order not found");
  return part;
}

/**
 * Recomputes everything the order derives from its parts and writes it: the
 * goods axis, the COD payment axis, `cancelledAt`, `total` and the display
 * `status`. Every seller-side mutation ends here, so the rules live in one
 * place rather than in each action.
 *
 * Pass the transaction client when the caller is mid-transaction, so the part it
 * just wrote is visible.
 */
export async function syncOrderFromParts(
  orderId: string,
  client: TransactionClient = prisma,
) {
  const order = await client.order.findUnique({
    where: { id: orderId },
    select: {
      paymentMethod: true,
      paymentStatus: true,
      fulfillmentStatus: true,
      cancelledAt: true,
      total: true,
      discountAmount: true,
      shippingTotal: true,
      sellerParts: {
        select: {
          shippedAt: true,
          deliveredAt: true,
          cancelledAt: true,
          codSettledAt: true,
          itemsSubtotal: true,
          shippingAmount: true,
          discountShare: true,
        },
      },
    },
  });
  if (!order) throw new NotFoundError("Order not found");

  const { fulfillmentStatus, allCancelled, codFullySettled } = aggregateSellerParts(
    order.sellerParts,
  );

  // Null means no active part is left - keep the axis rather than recomputing it
  // from an empty set, which would erase how far the order actually got.
  const nextFulfillment = fulfillmentStatus ?? order.fulfillmentStatus;

  const cancelledAt = allCancelled ? (order.cancelledAt ?? new Date()) : order.cancelledAt;

  // The only transition this owns is COD reaching PAID once every active part
  // has confirmed its cash. Refunds move the payment axis the other way and are
  // never second-guessed here.
  const paymentStatus =
    order.paymentMethod === PaymentMethod.COD &&
    order.paymentStatus === PaymentStatus.UNPAID &&
    codFullySettled
      ? PaymentStatus.PAID
      : order.paymentStatus;

  // What is still owed: active items, less their discount share, plus their
  // delivery. A COD courier must never collect for goods that are not coming.
  //
  // `discountAmount` and `shippingTotal` are recomputed alongside `total`, never
  // left behind. They are not display extras - the return flow reconstructs the
  // refundable gross as `total + discountAmount - shippingTotal`, so a total
  // that shrank while the other two still described the whole order would put
  // the "fully refunded" bar out of reach. That is reachable: a seller cancels
  // its part, the remaining seller delivers and collects, the order goes PAID,
  // and the buyer returns goods against figures that no longer agree.
  //
  // When nothing is active all three are left alone - the order is cancelled and
  // collects nothing, so the stored figures are only a record of what they were.
  const activeParts = order.sellerParts.filter((part) => part.cancelledAt == null);
  const money = allCancelled
    ? {
        total: order.total,
        discountAmount: order.discountAmount,
        shippingTotal: order.shippingTotal,
      }
    : {
        total: activeParts.reduce(
          (sum, part) => sum + part.itemsSubtotal - part.discountShare + part.shippingAmount,
          0,
        ),
        discountAmount: activeParts.reduce((sum, part) => sum + part.discountShare, 0),
        shippingTotal: activeParts.reduce((sum, part) => sum + part.shippingAmount, 0),
      };

  await client.order.update({
    where: { id: orderId },
    data: {
      fulfillmentStatus: nextFulfillment,
      paymentStatus,
      cancelledAt,
      ...money,
      status: deriveOrderStatus({
        paymentStatus,
        fulfillmentStatus: nextFulfillment,
        cancelledAt,
      }),
    },
  });

  return {
    paymentStatus,
    fulfillmentStatus: nextFulfillment,
    cancelledAt,
    ...money,
    orderCancelled: allCancelled,
  };
}

/**
 * Brings the order's single COD cash charge in line with what the parts now say.
 * Both seller actions end with this, because both can be the event that settles
 * or empties an order:
 *
 *   - nothing active left      -> the cash is never collected, so the charge fails
 *   - every active part settled -> the charge succeeded, for the reduced amount
 *   - otherwise                 -> still pending, but for the reduced amount
 *
 * The last two are why this is shared rather than inlined in the settle action.
 * A seller withdrawing can be what makes an order fully paid - when the only
 * other seller had already collected its cash - and that left the order PAID
 * with a charge stuck on PENDING.
 */
export async function syncCodCharge(
  tx: TransactionClient,
  orderId: string,
  synced: { orderCancelled: boolean; paymentStatus: PaymentStatus; total: number },
): Promise<void> {
  if (synced.orderCancelled) {
    await tx.paymentTransaction.updateMany({
      where: {
        orderId,
        type: PaymentTransactionType.CHARGE,
        provider: PaymentMethod.COD,
        status: PaymentTransactionStatus.PENDING,
      },
      data: { status: PaymentTransactionStatus.FAILED },
    });
    return;
  }

  await tx.paymentTransaction.updateMany({
    where: {
      orderId,
      type: PaymentTransactionType.CHARGE,
      provider: PaymentMethod.COD,
      status: PaymentTransactionStatus.PENDING,
    },
    data: {
      amount: synced.total,
      ...(synced.paymentStatus === PaymentStatus.PAID
        ? { status: PaymentTransactionStatus.SUCCEEDED }
        : {}),
    },
  });
}

/**
 * Writes a part's timestamps and keeps its derived `status` column in step, then
 * rolls the change up into the order. The column exists only so the seller order
 * list can filter on one field; `deriveSellerPartStatus` stays the authority.
 */
export async function updateSellerPart(
  client: TransactionClient,
  partId: string,
  data: {
    shippedAt?: Date | null;
    deliveredAt?: Date | null;
    cancelledAt?: Date | null;
    codSettledAt?: Date | null;
    trackingNumber?: string | null;
    carrier?: string | null;
  },
) {
  const current = await client.orderSellerPart.findUnique({
    where: { id: partId },
    select: { shippedAt: true, deliveredAt: true, cancelledAt: true },
  });
  if (!current) throw new NotFoundError("Order part not found");

  const next = {
    shippedAt: data.shippedAt !== undefined ? data.shippedAt : current.shippedAt,
    deliveredAt: data.deliveredAt !== undefined ? data.deliveredAt : current.deliveredAt,
    cancelledAt: data.cancelledAt !== undefined ? data.cancelledAt : current.cancelledAt,
  };

  return client.orderSellerPart.update({
    where: { id: partId },
    data: { ...data, status: deriveSellerPartStatus(next) },
  });
}
