import { logger } from "@/lib/logger";
import { prisma } from "@/core/db/prisma";
import { Prisma, CouponType } from "@/generated/prisma/client";
import { resolveCart, type CartItemRef } from "@/features/cart/db/resolveCart";
import { moneyIn, requireMoney, serializeMoney, type CurrencyRates, type MoneySet } from "@/lib/money";
import type { Currency } from "@/lib/currency-config";
import { copyIdentifier } from "@/lib/copyIdentifier";
import { NotFoundError } from "@/features/common/errors/domainErrors";
import { COUPON_CODE_MAX_LENGTH } from "../schema/coupons";

export type { CartItemRef };

export type Coupon = {
  id: string;
  code: string;
  type: CouponType;
  value: number;
  minOrder: number | null;
  usageLimit: number | null;
  usageCount: number;
  perUserLimit: number | null;
  expiresAt: Date | null;
  active: boolean;
};

/** Reason a coupon can't be applied (mapped to a localized message in the UI). */
export type CouponInvalidReason =
  | "notFound"
  | "expired"
  | "usedUp"
  | "alreadyUsed"
  | "minOrder";

export type CouponValidation =
  | {
      ok: true;
      couponId: string;
      code: string;
      type: CouponType;
      /** PERCENT: the percent. FIXED: the USD-cent mirror of `valueMoney`. */
      value: number;
      /**
       * The discount to actually apply, in the buyer's currency. FIXED takes
       * the exact amount the admin set for that currency; PERCENT is computed
       * against the cart total in that same currency. Either way it is capped
       * at the cart, and it is never a conversion of `discountUsd`.
       */
      discount: number;
      /** The USD-cent mirror of the discount, for records and reporting. */
      discountUsd: number;
      /** FIXED only: the exact discount per currency. */
      valueMoney: MoneySet | null;
    }
  | {
      ok: false;
      reason: CouponInvalidReason;
      /** The unmet minimum, in the buyer's currency, for the message. */
      minOrder?: number;
      minOrderUsd?: number;
    };

/** Sum of a cart's item prices in USD base cents - the basis for coupon math.
 *  Delegates to {@link resolveCart} so coupon eligibility is computed against the
 *  exact same purchasable subtotal as shipping, the order summary and checkout.
 *  Stale lines are excluded (and surfaced to the client by the resolver) rather
 *  than silently counted as zero. */
export async function cartSubtotalUsd(items: CartItemRef[]): Promise<number> {
  const { subtotalUsd } = await resolveCart(items);
  return subtotalUsd;
}

/**
 * The discount a coupon yields on a subtotal, in that subtotal's own currency.
 *
 * Both arguments must already be in the same currency - that is the whole
 * point. A PERCENT coupon is proportional, so it is computed directly against
 * the currency subtotal rather than computed in USD and converted, which would
 * round twice. A FIXED coupon takes the exact amount stored for that currency.
 * Never exceeds the subtotal.
 */
export function computeDiscountIn(
  coupon: Pick<Coupon, "type" | "value">,
  subtotal: number,
  fixedAmount: number,
): number {
  const raw =
    coupon.type === CouponType.PERCENT
      ? Math.round((subtotal * coupon.value) / 100)
      : fixedAmount;
  return Math.max(0, Math.min(raw, subtotal));
}

/** The USD-cent mirror of the same calculation, for the stored record. */
export function computeDiscount(
  coupon: Pick<Coupon, "type" | "value">,
  subtotalUsd: number,
): number {
  return computeDiscountIn(coupon, subtotalUsd, coupon.value);
}

/**
 * Validates a code against the live coupon state and a USD-base subtotal. Pure
 * read - the redemption itself is recorded separately when the order is created.
 *
 * `userId` (internal User.id) enables the per-customer limit: redemptions are
 * counted from the buyer's non-cancelled orders that snapshot this coupon, so a
 * cancelled order naturally frees the code again. Callers without a signed-in
 * user skip the check - checkout always has one (sign-in is required there).
 */
export async function validateCoupon(
  rawCode: string,
  subtotalUsd: number,
  userId: string | null | undefined,
  /**
   * The buyer's currency plus the cart total in it. Every threshold and every
   * discount is decided here, in the currency the buyer is actually shopping
   * in, against the amounts the admin set for that currency. Comparing a
   * converted USD figure instead is what put a cart a dinar either side of a
   * minimum that it visibly met on screen.
   */
  ctx: { currency: Currency; rates: CurrencyRates; subtotal: number },
): Promise<CouponValidation> {
  const code = rawCode.trim().toUpperCase();
  if (!code) return { ok: false, reason: "notFound" };

  const coupon = await prisma.coupon.findUnique({ where: { code } });
  if (!coupon || !coupon.active) return { ok: false, reason: "notFound" };
  if (coupon.expiresAt && coupon.expiresAt.getTime() <= Date.now()) {
    return { ok: false, reason: "expired" };
  }
  if (coupon.usageLimit != null && coupon.usageCount >= coupon.usageLimit) {
    return { ok: false, reason: "usedUp" };
  }
  if (coupon.perUserLimit != null && userId) {
    const usedByUser = await prisma.order.count({
      where: { couponId: coupon.id, userId, cancelledAt: null },
    });
    if (usedByUser >= coupon.perUserLimit) {
      return { ok: false, reason: "alreadyUsed" };
    }
  }
  if (coupon.minOrder != null) {
    // Mirror and set are written together, so a minimum that exists has a set.
    // The old fallback compared the USD mirror against a subtotal in the
    // buyer's currency, which is only right by accident when that is USD.
    const minOrderSet = requireMoney(coupon.minOrderMoney, `Coupon.minOrderMoney on ${coupon.id}`);
    const minOrder = moneyIn(minOrderSet, ctx.currency, ctx.rates);
    if (ctx.subtotal < minOrder) {
      return { ok: false, reason: "minOrder", minOrder, minOrderUsd: coupon.minOrder };
    }
  }

  const valueMoney =
    coupon.type === CouponType.FIXED
      ? requireMoney(coupon.valueMoney, `Coupon.valueMoney on ${coupon.id}`)
      : null;
  const fixedInCurrency = valueMoney
    ? moneyIn(valueMoney, ctx.currency, ctx.rates)
    : coupon.value;

  return {
    ok: true,
    couponId: coupon.id,
    code: coupon.code,
    type: coupon.type,
    value: coupon.value,
    discount: computeDiscountIn(coupon, ctx.subtotal, fixedInCurrency),
    discountUsd: computeDiscount(coupon, subtotalUsd),
    valueMoney,
  };
}

/**
 * Records one redemption. Atomic + capped: when a usageLimit is set the
 * conditional update only increments while there's room, so concurrent
 * checkouts can't push past the cap. Best-effort - never throws (a paid order
 * must persist even if the counter lost a race).
 */
export async function recordCouponUsage(couponId: string): Promise<void> {
  try {
    await prisma.coupon.updateMany({
      where: {
        id: couponId,
        OR: [{ usageLimit: null }, { usageCount: { lt: prisma.coupon.fields.usageLimit } }],
      },
      data: { usageCount: { increment: 1 } },
    });
  } catch (err) {
    logger.error("[coupons] recordCouponUsage failed", couponId, err);
  }
}

/**
 * Gives one redemption back, when an order that consumed the code is cancelled.
 * The per-user limit needs no such undo - it is counted live from the buyer's
 * non-cancelled orders - but `usageCount` is a plain column that only ever went
 * up, so a cancelled order used to burn a slot off `usageLimit` for good.
 *
 * Floored at zero through the `gt: 0` guard, so a counter that lost a race at
 * checkout (recordCouponUsage is capped and best-effort) can never be driven
 * negative. Best-effort in the same spirit: a cancellation must stand even if
 * the counter does not move.
 */
export async function releaseCouponUsage(couponId: string): Promise<void> {
  try {
    await prisma.coupon.updateMany({
      where: { id: couponId, usageCount: { gt: 0 } },
      data: { usageCount: { decrement: 1 } },
    });
  } catch (err) {
    logger.error("[coupons] releaseCouponUsage failed", couponId, err);
  }
}

// ── Admin CRUD ──────────────────────────────────────────────────────────────

export type CouponMutationData = {
  code: string;
  type: CouponType;
  /** PERCENT: the raw percent. FIXED: the USD-cent mirror of `valueMoney`. */
  value: number;
  /** Null for PERCENT - a percentage is not money and must never be scaled. */
  valueMoney: MoneySet | null;
  minOrder: number | null;
  minOrderMoney: MoneySet | null;
  usageLimit: number | null;
  perUserLimit: number | null;
  expiresAt: Date | null;
  active: boolean;
};

/** Money sets and their mirrors are written together, so the USD figure the
 *  minimum-order comparison reads can never disagree with the amount a buyer is
 *  actually discounted. */
function toCouponColumns(data: CouponMutationData) {
  return {
    ...data,
    code: data.code.trim().toUpperCase(),
    valueMoney: data.valueMoney ? serializeMoney(data.valueMoney) : Prisma.DbNull,
    minOrderMoney: data.minOrderMoney ? serializeMoney(data.minOrderMoney) : Prisma.DbNull,
  };
}

export function createCoupon(data: CouponMutationData) {
  return prisma.coupon.create({ data: toCouponColumns(data) });
}

export function updateCoupon(id: string, data: CouponMutationData) {
  return prisma.coupon.update({ where: { id }, data: toCouponColumns(data) });
}

export async function deleteCoupon(id: string) {
  try {
    return await prisma.coupon.delete({ where: { id } });
  } catch (e) {
    // Record already gone (double-click, or a stale row after a duplicate
    // refreshed the list) - deletion is idempotent, so treat as success.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") return null;
    throw e;
  }
}

/** Copies a coupon with a fresh unique code, reset usage and inactive by default.
 *  Returns the new coupon plus the source's human-readable code as `sourceLabel`
 *  (for the audit trail - so it records "from: SAVE10", not a raw UUID). */
export async function duplicateCoupon(id: string) {
  const src = await prisma.coupon.findUnique({ where: { id } });
  if (!src) throw new NotFoundError(`Coupon ${id} not found`);
  // A coupon has no name to carry a localized "Copy of" - `code` is both its
  // identifier and what the buyer types at checkout - so it gets the identifier
  // half of the duplicate convention, uppercased to match how codes are stored.
  const created = await prisma.coupon.create({
    data: {
      code: copyIdentifier(src.code, COUPON_CODE_MAX_LENGTH).toUpperCase(),
      type: src.type,
      value: src.value,
      // Copy the money sets too - a duplicate that kept only the USD mirror
      // would silently re-derive (and shift) the other currencies.
      valueMoney: src.valueMoney ?? Prisma.DbNull,
      minOrder: src.minOrder,
      minOrderMoney: src.minOrderMoney ?? Prisma.DbNull,
      usageLimit: src.usageLimit,
      perUserLimit: src.perUserLimit,
      expiresAt: src.expiresAt,
      active: false,
    },
  });
  return { ...created, sourceLabel: src.code };
}

export function getCouponById(id: string) {
  return prisma.coupon.findUnique({ where: { id } });
}

/** All coupons for the admin list, newest first. */
export function getAllCoupons() {
  return prisma.coupon.findMany({ orderBy: { createdAt: "desc" } });
}

/** Cursor-paginated coupon list for the admin table (search by code, status
 *  facet, sort). Mirrors the audit/orders list pattern. */
export async function getCouponsPage({
  take,
  cursor,
  search,
  status,
  sortBy = "createdAt",
  sortOrder = "desc",
}: {
  take: number;
  cursor?: string;
  search?: string;
  status?: "active" | "inactive";
  sortBy?: "createdAt" | "code";
  sortOrder?: "asc" | "desc";
}) {
  const where: Prisma.CouponWhereInput = {};
  if (search) where.code = { contains: search, mode: "insensitive" };
  if (status) where.active = status === "active";

  const orderBy: Prisma.CouponOrderByWithRelationInput[] =
    sortBy === "code" ? [{ code: sortOrder }, { id: "asc" }] : [{ createdAt: sortOrder }, { id: "asc" }];

  const rows = await prisma.coupon.findMany({
    where,
    orderBy,
    take: take + 1,
    cursor: cursor ? { id: cursor } : undefined,
    skip: cursor ? 1 : 0,
  });

  let nextCursor: string | undefined;
  if (rows.length > take) nextCursor = rows.pop()!.id;
  return { items: rows, nextCursor };
}

export type CouponListItem = Awaited<ReturnType<typeof getCouponsPage>>["items"][number];

/** True when another coupon already uses this code (case-insensitive). */
export async function isCouponCodeTaken(code: string, excludeId?: string): Promise<boolean> {
  const existing = await prisma.coupon.findUnique({
    where: { code: code.trim().toUpperCase() },
    select: { id: true },
  });
  return !!existing && existing.id !== excludeId;
}

export type { Prisma };
