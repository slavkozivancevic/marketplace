import { logger } from "@/lib/logger";
import { prisma } from "@/core/db/prisma";
import { convertCents } from "@/lib/currency";
import type { Currency } from "@/lib/currency-config";
import {
  Prisma,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  FulfillmentStatus,
  PaymentTransactionType,
  PaymentTransactionStatus,
  ReturnStatus,
} from "@/generated/prisma/client";
import { deriveOrderStatus } from "@/features/orders/status";
import { recordAudit, SYSTEM_ACTOR } from "@/features/audit/db/audit";
import { recordCouponUsage } from "@/features/coupons/db/coupons";
import { cacheTag } from "next/cache";
import { CacheTags } from "@/lib/cache/tags";
import { revalidateOrderCache } from "./cache";
import { revalidateProductCache } from "@/features/products/db/cache";
import { recordPurchaseEvents } from "@/features/interactions/db/interactions";
import { InsufficientStockError } from "@/features/common/errors/domainErrors";
import { reverseSellerPayoutsForOrder } from "@/features/payments/db/payouts";

export async function getUserOrders(userId: string) {
  "use cache";
  cacheTag(CacheTags.orders.byUser(userId));

  const orders = await prisma.order.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: {
      items: {
        // Deterministic item order so the "Items" column is stable across
        // reloads and matches the org-orders list (which sorts the same way)
        // for the shared items of a given order.
        orderBy: { id: "asc" },
        include: {
          product: { select: { translations: { select: { locale: true, title: true } } } },
          variant: { select: { sku: true } },
        },
      },
    },
  });

  return orders.map((order) => ({
    ...order,
    total: Number(order.total),
    exchangeRate: order.exchangeRate != null ? Number(order.exchangeRate) : null,
    items: order.items.map((item) => ({
      ...item,
      price: Number(item.price),
    })),
  }));
}

/**
 * Cursor-paginated variant of {@link getUserOrders}.
 *
 * Not cached via "use cache" - TanStack Query owns the client cache,
 * and Next.js cache for paginated endpoints causes unbounded growth.
 */
export async function getUserOrdersPage({
  userId,
  take,
  cursor,
  search,
  status,
  sortBy = "createdAt",
  sortOrder = "desc",
}: {
  userId: string;
  take: number;
  cursor?: string;
  search?: string;
  status?: string[];
  sortBy?: "createdAt" | "total";
  sortOrder?: "asc" | "desc";
}) {
  const where: Prisma.OrderWhereInput = {
    userId,
  };

  if (status && status.length > 0) {
    where.status = { in: status as OrderStatus[] };
  }

  if (search) {
    where.OR = [
      { id: { contains: search, mode: "insensitive" } },
      {
        items: {
          some: {
            product: {
              translations: {
                some: { title: { contains: search, mode: "insensitive" } },
              },
            },
          },
        },
      },
    ];
  }

  const sortField: Prisma.OrderOrderByWithRelationInput = sortBy === "createdAt" ? { createdAt: sortOrder } : { total: sortOrder };
  const orderBy: Prisma.OrderOrderByWithRelationInput[] = [sortField, { id: "asc" }];

  const rows = await prisma.order.findMany({
    where,
    orderBy,
    take: take + 1,
    cursor: cursor ? { id: cursor } : undefined,
    skip: cursor ? 1 : 0,
    include: {
      items: {
        // Deterministic item order so the "Items" column is stable across
        // reloads and matches the org-orders list (which sorts the same way)
        // for the shared items of a given order.
        orderBy: { id: "asc" },
        include: {
          product: { select: { translations: { select: { locale: true, title: true } } } },
          variant: { select: { sku: true } },
        },
      },
    },
  });

  let nextCursor: string | undefined;
  if (rows.length > take) {
    const next = rows.pop();
    nextCursor = next?.id;
  }

  // Flag orders with an in-flight return (REQUESTED/APPROVED/SHIPPED - i.e. not
  // yet REFUNDED or REJECTED) so the list can show a "return in progress" hint
  // without changing the order's own status.
  const pageOrderIds = rows.map((o) => o.id);
  const activeReturns = pageOrderIds.length
    ? await prisma.return.findMany({
        where: {
          orderId: { in: pageOrderIds },
          status: {
            in: [ReturnStatus.REQUESTED, ReturnStatus.APPROVED, ReturnStatus.SHIPPED],
          },
        },
        select: { orderId: true },
      })
    : [];
  const ordersWithActiveReturn = new Set(activeReturns.map((r) => r.orderId));

  const items = rows.map((order) => ({
    ...order,
    total: Number(order.total),
    exchangeRate: order.exchangeRate != null ? Number(order.exchangeRate) : null,
    hasActiveReturn: ordersWithActiveReturn.has(order.id),
    items: order.items.map((item) => ({
      ...item,
      price: Number(item.price),
    })),
  }));

  return { items, nextCursor };
}

export type UserOrderListItem = Awaited<
  ReturnType<typeof getUserOrdersPage>
>["items"][number];

/**
 * Disjunctive status counts for the buyer's order list sidebar. Ignores the
 * status selection itself (so every status stays countable while one is
 * checked) but applies the active search, matching the list query.
 */
export async function getUserOrderStatusCounts({
  userId,
  search,
}: {
  userId: string;
  search?: string;
}): Promise<Record<string, number>> {
  const where: Prisma.OrderWhereInput = { userId };

  if (search) {
    where.OR = [
      { id: { contains: search, mode: "insensitive" } },
      {
        items: {
          some: {
            product: {
              translations: {
                some: { title: { contains: search, mode: "insensitive" } },
              },
            },
          },
        },
      },
    ];
  }

  const groups = await prisma.order.groupBy({
    by: ["status"],
    where,
    _count: { _all: true },
  });

  const counts: Record<string, number> = {};
  for (const g of groups) counts[g.status] = g._count._all;
  return counts;
}

export async function getOrderByStripeSessionId(stripeSessionId: string) {
  const order = await prisma.order.findUnique({
    where: { stripeSessionId },
    select: {
      id: true,
      locale: true,
      currency: true,
      total: true,
      discountAmount: true,
      couponCode: true,
      shippingTotal: true,
      shippingName: true,
      shippingLine1: true,
      shippingLine2: true,
      shippingCity: true,
      shippingState: true,
      shippingPostalCode: true,
      shippingCountry: true,
      items: {
        select: {
          id: true,
          quantity: true,
          price: true,
          product: {
            select: {
              translations: { select: { locale: true, title: true } },
              media: {
                orderBy: { order: "asc" },
                take: 1,
                where: { mediaType: "IMAGE" },
                select: { url: true, thumbUrl: true },
              },
            },
          },
          variant: {
            select: {
              sku: true,
              media: {
                orderBy: { order: "asc" },
                take: 1,
                select: { media: { select: { url: true, thumbUrl: true, mediaType: true } } },
              },
            },
          },
        },
      },
    },
  });
  if (!order) return null;
  return {
    ...order,
    total: Number(order.total),
    items: order.items.map((item) => ({ ...item, price: Number(item.price) })),
  };
}

// Not cached: a buyer's order detail reflects live status (returns, refunds)
// and must update on the next navigation without depending on tag revalidation
// reaching the client Router Cache. Mirrors the (uncached) seller-side
// getOrgOrderById so both order detail pages refresh consistently.
export async function getOrderById(id: string, userId: string) {
  const order = await prisma.order.findFirst({
    where: { id, userId },
    include: {
      items: {
        include: {
          product: {
            select: {
              id: true,
              organizationId: true,
              organization: { select: { name: true } },
              translations: { select: { locale: true, title: true } },
              media: {
                orderBy: { order: "asc" },
                take: 1,
                // Order line items show a still thumbnail - keep videos out
                // so the order page doesn't try to play a video inline.
                where: { mediaType: "IMAGE" },
              },
            },
          },
          variant: {
            select: {
              sku: true,
              attributeValues: {
                // Pull each axis option's per-locale label so the order page can
                // localize the variant label (controlled attribute vocabulary).
                select: {
                  option: {
                    select: {
                      value: true,
                      translations: { select: { locale: true, label: true } },
                    },
                  },
                },
              },
              media: {
                orderBy: { order: "asc" },
                take: 1,
                select: { media: { select: { url: true, thumbUrl: true, mediaType: true } } },
              },
            },
          },
        },
      },
    },
  });

  if (!order) return null;

  return {
    ...order,
    total: Number(order.total),
    exchangeRate: order.exchangeRate != null ? Number(order.exchangeRate) : null,
    items: order.items.map((item) => ({
      ...item,
      price: Number(item.price),
    })),
  };
}

/**
 * Sum of external (Stripe dashboard) refunds on this order - the buyer-facing
 * amount, straight from Stripe, recorded by reconcileStripeRefund with
 * `organizationId: null`. Kept separate from Return.refundAmount (the app's
 * own return flow), which is already coupon-adjusted and summed elsewhere -
 * the two are additive, not alternatives.
 */
export async function getExternalRefundedTotal(orderId: string): Promise<number> {
  const agg = await prisma.paymentTransaction.aggregate({
    where: {
      orderId,
      type: PaymentTransactionType.REFUND,
      status: PaymentTransactionStatus.SUCCEEDED,
      organizationId: null,
    },
    _sum: { amount: true },
  });
  return agg._sum.amount ?? 0;
}

export type FulfillOrderItem = {
  productId: string;
  variantId: string | null;
  quantity: number;
};

export type ShippingAddress = {
  name: string | null;
  line1: string | null;
  line2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
};

export async function fulfillOrder({
  userId,
  stripeSessionId,
  paymentIntentId,
  totalCents,
  currency,
  exchangeRate,
  items,
  shipping,
  locale = "en",
  couponId,
  couponCode,
  shippingTotal = 0,
  shippingByOrg,
}: {
  userId: string;
  stripeSessionId: string;
  // Stripe PaymentIntent id (pi_...), recorded as the CHARGE ledger row's
  // provider id - also doubles as an idempotency key.
  paymentIntentId?: string;
  totalCents: number;
  currency?: string;
  exchangeRate?: number;
  items: FulfillOrderItem[];
  shipping?: ShippingAddress;
  locale?: string;
  couponId?: string;
  couponCode?: string;
  // Delivery charged at checkout (order currency): whole-order total + the
  // per-seller split (orgId -> amount) snapshotted for payouts.
  shippingTotal?: number;
  shippingByOrg?: Record<string, number>;
}) {
  const existing = await prisma.order.findUnique({
    where: { stripeSessionId },
  });

  if (existing) {
    logger.info(
      `Order for session ${stripeSessionId} already exists, skipping`,
    );
    return existing;
  }

  // Batch-fetch all prices upfront - avoids N+1 queries inside the transaction
  const variantIds = items.filter((i) => i.variantId).map((i) => i.variantId!);
  const productOnlyIds = items.filter((i) => !i.variantId).map((i) => i.productId);

  const [variants, products] = await Promise.all([
    variantIds.length
      ? prisma.productVariant.findMany({
          where: { id: { in: variantIds } },
          select: { id: true, price: true },
        })
      : [],
    productOnlyIds.length
      ? prisma.product.findMany({
          where: { id: { in: productOnlyIds } },
          select: { id: true, price: true, stock: true },
        })
      : [],
  ]);

  const variantMap = new Map(variants.map((v) => [v.id, v]));
  const productMap = new Map(products.map((p) => [p.id, p]));

  const rate = exchangeRate ?? 1;
  const curr = (currency ?? "usd") as Currency;
  const itemsWithPrice = items.map((item) => {
    if (item.variantId) {
      const variant = variantMap.get(item.variantId);
      if (!variant) throw new Error(`Variant ${item.variantId} not found`);
      return { ...item, price: convertCents(Number(variant.price), curr, rate) };
    }
    const product = productMap.get(item.productId);
    if (!product) throw new Error(`Product ${item.productId} not found`);
    return { ...item, price: convertCents(Number(product.price), curr, rate) };
  });

  // `totalCents` (Stripe amount_total) = (subtotal - coupon discount) + shipping.
  // Recover the items discount net of shipping (shipping is added on top and is
  // never discounted).
  const subtotalCents = itemsWithPrice.reduce((s, i) => s + i.price * i.quantity, 0);
  const discountAmount = Math.max(0, subtotalCents - (totalCents - shippingTotal));

  const order = await prisma.$transaction(async (tx) => {
    // Atomic stock decrement - raw SQL WHERE stock >= quantity prevents overselling.
    // If affected rows = 0, another concurrent transaction already took the last unit.
    for (const item of itemsWithPrice) {
      if (item.variantId) {
        const affected = await tx.$executeRaw`
          UPDATE "ProductVariant"
          SET stock = stock - ${item.quantity}
          WHERE id = ${item.variantId} AND stock >= ${item.quantity}
        `;
        if (affected === 0) {
          throw new InsufficientStockError(`Insufficient stock for variant ${item.variantId}`);
        }
      } else {
        const prod = productMap.get(item.productId)!;
        if (prod.stock !== null) {
          const affected = await tx.$executeRaw`
            UPDATE "Product"
            SET stock = stock - ${item.quantity}
            WHERE id = ${item.productId} AND stock >= ${item.quantity}
          `;
          if (affected === 0) {
            throw new InsufficientStockError(`Insufficient stock for product ${item.productId}`);
          }
        }
      }
    }

    const order = await tx.order.create({
      data: {
        userId,
        stripeSessionId,
        // Card captured: paid, but nothing shipped yet -> derived PROCESSING
        // (NOT "completed"; that only happens once it is delivered).
        paymentStatus: PaymentStatus.PAID,
        fulfillmentStatus: FulfillmentStatus.UNFULFILLED,
        status: deriveOrderStatus({
          paymentStatus: PaymentStatus.PAID,
          fulfillmentStatus: FulfillmentStatus.UNFULFILLED,
          cancelledAt: null,
        }),
        total: totalCents,
        couponId: couponId ?? null,
        couponCode: couponCode ?? null,
        discountAmount,
        shippingTotal,
        shippingByOrg: shippingByOrg ?? undefined,
        locale,
        currency: currency ?? "usd",
        exchangeRate: exchangeRate ?? 1,
        shippingName: shipping?.name,
        shippingLine1: shipping?.line1,
        shippingLine2: shipping?.line2,
        shippingCity: shipping?.city,
        shippingState: shipping?.state,
        shippingPostalCode: shipping?.postalCode,
        shippingCountry: shipping?.country,
        items: {
          create: itemsWithPrice.map((item) => ({
            productId: item.productId,
            variantId: item.variantId,
            quantity: item.quantity,
            price: item.price,
          })),
        },
      },
    });

    // Ledger: card payment was captured by Stripe before this webhook fired.
    await tx.paymentTransaction.create({
      data: {
        orderId: order.id,
        type: PaymentTransactionType.CHARGE,
        status: PaymentTransactionStatus.SUCCEEDED,
        provider: PaymentMethod.STRIPE,
        providerId: paymentIntentId ?? null,
        amount: totalCents,
        currency: currency ?? "usd",
      },
    });

    revalidateOrderCache(userId, order.id);
    return order;
  });

  const uniqueProductIds = [...new Set(items.map((i) => i.productId))];
  const allProducts = await prisma.product.findMany({
    where: { id: { in: uniqueProductIds } },
    select: { id: true, organizationId: true },
  });
  allProducts.forEach((p) => revalidateProductCache(p.organizationId, p.id));

  if (couponId) await recordCouponUsage(couponId);

  // Engagement log: one PURCHASE event per product (best-effort, post-commit).
  await recordPurchaseEvents({
    userId,
    orderId: order.id,
    productIds: items.map((i) => i.productId),
  });

  // NOTE: sellers are NOT paid here. The platform holds the captured funds and
  // releases each seller's transfer when that seller ships (releaseSellerPayout),
  // so an order refunded before fulfillment never pays out.
  return order;
}

export async function createCodOrder({
  userId,
  totalInCurrency,
  currency = "usd",
  exchangeRate = 1,
  items,
  shipping,
  locale,
  couponId,
  couponCode,
  shippingTotal = 0,
  shippingByOrg,
}: {
  userId: string;
  totalInCurrency: number;
  currency?: string;
  exchangeRate?: number;
  items: FulfillOrderItem[];
  shipping: ShippingAddress;
  locale?: string;
  couponId?: string;
  couponCode?: string;
  // Delivery charged at checkout (order currency): whole-order total + the
  // per-seller split (orgId -> amount) snapshotted for payouts.
  shippingTotal?: number;
  shippingByOrg?: Record<string, number>;
}) {
  const variantIds = items.filter((i) => i.variantId).map((i) => i.variantId!);
  const productOnlyIds = items.filter((i) => !i.variantId).map((i) => i.productId);

  const [variants, products] = await Promise.all([
    variantIds.length
      ? prisma.productVariant.findMany({
          where: { id: { in: variantIds } },
          select: { id: true, price: true },
        })
      : [],
    productOnlyIds.length
      ? prisma.product.findMany({
          where: { id: { in: productOnlyIds } },
          select: { id: true, price: true, stock: true },
        })
      : [],
  ]);

  const variantMap = new Map(variants.map((v) => [v.id, v]));
  const productMap = new Map(products.map((p) => [p.id, p]));

  const itemsWithPrice = items.map((item) => {
    if (item.variantId) {
      const variant = variantMap.get(item.variantId);
      if (!variant) throw new Error(`Variant ${item.variantId} not found`);
      return { ...item, price: convertCents(Number(variant.price), currency as Currency, exchangeRate) };
    }
    const product = productMap.get(item.productId);
    if (!product) throw new Error(`Product ${item.productId} not found`);
    return { ...item, price: convertCents(Number(product.price), currency as Currency, exchangeRate) };
  });

  // `totalInCurrency` = (subtotal - coupon discount) + shipping. Recover the
  // items discount net of shipping (shipping is added on top, never discounted).
  const subtotalCents = itemsWithPrice.reduce((s, i) => s + i.price * i.quantity, 0);
  const discountAmount = Math.max(0, subtotalCents - (totalInCurrency - shippingTotal));

  const order = await prisma.$transaction(async (tx) => {
    for (const item of itemsWithPrice) {
      if (item.variantId) {
        const affected = await tx.$executeRaw`
          UPDATE "ProductVariant"
          SET stock = stock - ${item.quantity}
          WHERE id = ${item.variantId} AND stock >= ${item.quantity}
        `;
        if (affected === 0) {
          throw new InsufficientStockError(`Insufficient stock for variant ${item.variantId}`);
        }
      } else {
        const prod = productMap.get(item.productId)!;
        if (prod.stock !== null) {
          const affected = await tx.$executeRaw`
            UPDATE "Product"
            SET stock = stock - ${item.quantity}
            WHERE id = ${item.productId} AND stock >= ${item.quantity}
          `;
          if (affected === 0) {
            throw new InsufficientStockError(`Insufficient stock for product ${item.productId}`);
          }
        }
      }
    }

    const created = await tx.order.create({
      data: {
        userId,
        paymentMethod: PaymentMethod.COD,
        // COD: cash collected on delivery, so unpaid + unfulfilled -> PENDING.
        paymentStatus: PaymentStatus.UNPAID,
        fulfillmentStatus: FulfillmentStatus.UNFULFILLED,
        status: deriveOrderStatus({
          paymentStatus: PaymentStatus.UNPAID,
          fulfillmentStatus: FulfillmentStatus.UNFULFILLED,
          cancelledAt: null,
        }),
        total: totalInCurrency,
        couponId: couponId ?? null,
        couponCode: couponCode ?? null,
        discountAmount,
        shippingTotal,
        shippingByOrg: shippingByOrg ?? undefined,
        locale: locale ?? "en",
        currency,
        exchangeRate,
        shippingName: shipping.name,
        shippingLine1: shipping.line1,
        shippingLine2: shipping.line2,
        shippingCity: shipping.city,
        shippingState: shipping.state,
        shippingPostalCode: shipping.postalCode,
        shippingCountry: shipping.country,
        items: {
          create: itemsWithPrice.map((item) => ({
            productId: item.productId,
            variantId: item.variantId,
            quantity: item.quantity,
            price: item.price,
          })),
        },
      },
    });

    // Ledger: COD cash is collected on delivery, so the charge starts PENDING
    // (no provider id - there is no PSP transaction for cash).
    await tx.paymentTransaction.create({
      data: {
        orderId: created.id,
        type: PaymentTransactionType.CHARGE,
        status: PaymentTransactionStatus.PENDING,
        provider: PaymentMethod.COD,
        amount: totalInCurrency,
        currency,
      },
    });

    return created;
  });

  revalidateOrderCache(userId, order.id);
  if (couponId) await recordCouponUsage(couponId);

  const uniqueProductIds = [...new Set(items.map((i) => i.productId))];
  const allProducts = await prisma.product.findMany({
    where: { id: { in: uniqueProductIds } },
    select: { id: true, organizationId: true },
  });
  allProducts.forEach((p) => revalidateProductCache(p.organizationId, p.id));

  // Engagement log: one PURCHASE event per product (best-effort, post-commit).
  await recordPurchaseEvents({
    userId,
    orderId: order.id,
    productIds: items.map((i) => i.productId),
  });

  return order;
}

/**
 * Reconciles Stripe refunds reported by a `charge.refunded` webhook against our
 * ledger. Refunds the app itself created (the Return flow) are already recorded
 * by their refund id and are skipped here, so they are never double-counted.
 * Only EXTERNAL refunds - i.e. someone clicking Refund in the Stripe dashboard -
 * are recorded. When cumulative refunds cover the order total the order is
 * marked REFUNDED; stock is restocked only when no app return already did so
 * (a return restocks the specific items it returned).
 *
 * Returns the order plus what happened so the caller can email the right
 * party: `kind: "full"` once cumulative refunds cover the order total,
 * `kind: "partial"` for a partial external refund (amount is this call's new
 * external total, not the cumulative one), or null when there was nothing new
 * to reconcile.
 */
export async function reconcileStripeRefund(
  stripeSessionId: string,
  refunds: { id: string; amount: number }[],
) {
  const order = await prisma.order.findUnique({
    where: { stripeSessionId },
    include: {
      items: { select: { productId: true, variantId: true, quantity: true } },
    },
  });
  if (!order) {
    logger.info(`No order found for session ${stripeSessionId}, skipping refund`);
    return null;
  }

  // Drop refunds already in our ledger (created by the app's own refund calls).
  const ids = refunds.map((r) => r.id);
  const known = ids.length
    ? await prisma.paymentTransaction.findMany({
        where: { providerId: { in: ids } },
        select: { providerId: true },
      })
    : [];
  const knownSet = new Set(known.map((k) => k.providerId));
  const external = refunds.filter((r) => !knownSet.has(r.id));
  if (external.length === 0) {
    logger.info(`charge.refunded for ${stripeSessionId} already recorded by app, skipping`);
    return null;
  }

  // If a return already refunded part of this order, it restocked its own items;
  // don't restock again on a manual refund. Return refunds are org-scoped.
  const returnRefunds = await prisma.paymentTransaction.count({
    where: {
      orderId: order.id,
      type: PaymentTransactionType.REFUND,
      organizationId: { not: null },
    },
  });

  let becameRefunded = false;
  await prisma.$transaction(async (tx) => {
    for (const r of external) {
      await tx.paymentTransaction.create({
        data: {
          orderId: order.id,
          type: PaymentTransactionType.REFUND,
          status: PaymentTransactionStatus.SUCCEEDED,
          provider: PaymentMethod.STRIPE,
          providerId: r.id,
          amount: r.amount,
          currency: order.currency,
        },
      });
    }

    const agg = await tx.paymentTransaction.aggregate({
      where: { orderId: order.id, type: PaymentTransactionType.REFUND },
      _sum: { amount: true },
    });

    const refundedTotal = agg._sum.amount ?? 0;
    if (refundedTotal >= order.total && order.paymentStatus !== PaymentStatus.REFUNDED) {
      await tx.order.update({
        where: { id: order.id },
        data: { paymentStatus: PaymentStatus.REFUNDED, status: OrderStatus.REFUNDED },
      });
      becameRefunded = true;

      if (returnRefunds === 0) {
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
    } else if (
      refundedTotal > 0 &&
      order.paymentStatus !== PaymentStatus.REFUNDED &&
      order.paymentStatus !== PaymentStatus.PARTIALLY_REFUNDED
    ) {
      // External partial refund (Stripe dashboard): mark the payment axis but
      // don't restock - we don't know which line items the manual refund covered.
      await tx.order.update({
        where: { id: order.id },
        data: {
          paymentStatus: PaymentStatus.PARTIALLY_REFUNDED,
          status: deriveOrderStatus({
            paymentStatus: PaymentStatus.PARTIALLY_REFUNDED,
            fulfillmentStatus: order.fulfillmentStatus,
            cancelledAt: order.cancelledAt,
          }),
        },
      });
    }
  });

  revalidateOrderCache(order.userId, order.id);
  const productIds = [...new Set(order.items.map((i) => i.productId))];
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, organizationId: true },
  });
  products.forEach((p) => revalidateProductCache(p.organizationId, p.id));

  // External (Stripe dashboard) refund - no signed-in actor, attribute to system.
  const externalTotal = external.reduce((s, r) => s + r.amount, 0);
  await recordAudit({
    action: becameRefunded ? "order.refunded" : "order.partially_refunded",
    entityType: "Order",
    entityId: order.id,
    diff: { external: true, amount: externalTotal, currency: order.currency },
    actor: SYSTEM_ACTOR,
  });

  // The whole order was refunded outside the app - any seller already paid out
  // on it needs their transfer clawed back too, or they simply keep money for a
  // refunded order. Best-effort and after the ledger/audit writes above so a
  // Stripe hiccup here never blocks the refund itself from being recorded.
  if (becameRefunded) {
    await reverseSellerPayoutsForOrder(order.id).catch((err) =>
      logger.error("[reconcileStripeRefund] reverseSellerPayoutsForOrder failed", err),
    );
  }

  if (becameRefunded) {
    return { order, kind: "full" as const, amount: externalTotal };
  }
  // A second (or later) manual refund on an already-PARTIALLY_REFUNDED order
  // skips the status transition above (it's idempotent, one-time), but the
  // buyer still needs telling about THIS increment - so "partial" is keyed off
  // externalTotal, not the status transition.
  if (externalTotal > 0) {
    return { order, kind: "partial" as const, amount: externalTotal };
  }
  return null;
}
