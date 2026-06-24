import { prisma } from "@/core/db/prisma";
import { Prisma, CouponType } from "@/generated/prisma/client";

export type Coupon = {
  id: string;
  code: string;
  type: CouponType;
  value: number;
  minOrder: number | null;
  usageLimit: number | null;
  usageCount: number;
  expiresAt: Date | null;
  active: boolean;
};

/** Reason a coupon can't be applied (mapped to a localized message in the UI). */
export type CouponInvalidReason = "notFound" | "expired" | "usedUp" | "minOrder";

export type CouponValidation =
  | { ok: true; couponId: string; code: string; type: CouponType; value: number; discountUsd: number }
  | { ok: false; reason: CouponInvalidReason; minOrder?: number };

export type CartItemRef = { productId: string; variantId: string | null; quantity: number };

/** Sum of a cart's item prices in USD base cents - the basis for coupon math.
 *  Prices are read from the DB (never trusted from the client). */
export async function cartSubtotalUsd(items: CartItemRef[]): Promise<number> {
  const variantIds = items.filter((i) => i.variantId).map((i) => i.variantId!);
  const productIds = items.filter((i) => !i.variantId).map((i) => i.productId);
  const [variants, products] = await Promise.all([
    variantIds.length
      ? prisma.productVariant.findMany({ where: { id: { in: variantIds } }, select: { id: true, price: true } })
      : [],
    productIds.length
      ? prisma.product.findMany({ where: { id: { in: productIds } }, select: { id: true, price: true } })
      : [],
  ]);
  const variantPrice = new Map(variants.map((v) => [v.id, Number(v.price)]));
  const productPrice = new Map(products.map((p) => [p.id, Number(p.price)]));

  let subtotal = 0;
  for (const it of items) {
    const unit = it.variantId ? variantPrice.get(it.variantId) : productPrice.get(it.productId);
    if (unit != null) subtotal += unit * it.quantity;
  }
  return subtotal;
}

/** Discount (USD base cents) a coupon yields on a given subtotal. Never exceeds
 *  the subtotal. PERCENT rounds to the nearest cent. */
export function computeDiscount(
  coupon: Pick<Coupon, "type" | "value">,
  subtotalUsd: number,
): number {
  const raw =
    coupon.type === CouponType.PERCENT
      ? Math.round((subtotalUsd * coupon.value) / 100)
      : coupon.value;
  return Math.max(0, Math.min(raw, subtotalUsd));
}

/**
 * Validates a code against the live coupon state and a USD-base subtotal. Pure
 * read - the redemption itself is recorded separately when the order is created.
 */
export async function validateCoupon(
  rawCode: string,
  subtotalUsd: number,
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
  if (coupon.minOrder != null && subtotalUsd < coupon.minOrder) {
    return { ok: false, reason: "minOrder", minOrder: coupon.minOrder };
  }

  return {
    ok: true,
    couponId: coupon.id,
    code: coupon.code,
    type: coupon.type,
    value: coupon.value,
    discountUsd: computeDiscount(coupon, subtotalUsd),
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
    console.error("[coupons] recordCouponUsage failed", couponId, err);
  }
}

// ── Admin CRUD ──────────────────────────────────────────────────────────────

export type CouponMutationData = {
  code: string;
  type: CouponType;
  value: number;
  minOrder: number | null;
  usageLimit: number | null;
  expiresAt: Date | null;
  active: boolean;
};

export function createCoupon(data: CouponMutationData) {
  return prisma.coupon.create({
    data: { ...data, code: data.code.trim().toUpperCase() },
  });
}

export function updateCoupon(id: string, data: CouponMutationData) {
  return prisma.coupon.update({
    where: { id },
    data: { ...data, code: data.code.trim().toUpperCase() },
  });
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
 *  Returns the new coupon plus the source's human-readable code (for the audit
 *  trail - so it records "from: SAVE10", not a raw UUID). */
export async function duplicateCoupon(id: string) {
  const src = await prisma.coupon.findUnique({ where: { id } });
  if (!src) throw new Error("Coupon not found");
  const suffix = Date.now().toString(36).slice(-4).toUpperCase();
  const created = await prisma.coupon.create({
    data: {
      code: `${src.code}-${suffix}`,
      type: src.type,
      value: src.value,
      minOrder: src.minOrder,
      usageLimit: src.usageLimit,
      expiresAt: src.expiresAt,
      active: false,
    },
  });
  return { ...created, sourceCode: src.code };
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
