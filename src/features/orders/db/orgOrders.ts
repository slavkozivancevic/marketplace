import { prisma } from "@/core/db/prisma";
import {
  Prisma,
  OrderStatus,
  ReturnStatus,
  PaymentTransactionType,
} from "@/generated/prisma/client";
import { sellerNetAmount, platformFeeAmount } from "@/features/payments/config";

// ─── List ─────────────────────────────────────────────────────────────────────

export async function getOrgOrdersPage({
  organizationId,
  take,
  cursor,
  search,
  status,
  sortBy = "createdAt",
  sortOrder = "desc",
}: {
  organizationId: string;
  take: number;
  cursor?: string;
  search?: string;
  status?: string[];
  sortBy?: "createdAt" | "total";
  sortOrder?: "asc" | "desc";
}) {
  // Build conditions separately to avoid Prisma recursive-type circular reference
  const orgCondition = { items: { some: { product: { organizationId } } } };

  const searchConditions = search
    ? [
        {
          OR: [
            { id: { contains: search, mode: "insensitive" as const } },
            { user: { name: { contains: search, mode: "insensitive" as const } } },
            {
              items: {
                some: {
                  product: {
                    organizationId,
                    translations: {
                      some: { title: { contains: search, mode: "insensitive" as const } },
                    },
                  },
                },
              },
            },
          ],
        },
      ]
    : [];

  const statusCondition =
    status && status.length > 0
      ? [{ status: { in: status as OrderStatus[] } }]
      : [];

  const sortField: Prisma.OrderOrderByWithRelationInput =
    sortBy === "createdAt" ? { createdAt: sortOrder } : { total: sortOrder };

  const rows = await prisma.order.findMany({
    where: {
      AND: [orgCondition, ...searchConditions, ...statusCondition],
    },
    orderBy: [sortField, { id: "asc" }],
    take: take + 1,
    cursor: cursor ? { id: cursor } : undefined,
    skip: cursor ? 1 : 0,
    include: {
      items: {
        where: { product: { organizationId } },
        include: {
          product: {
            select: {
              id: true,
              translations: { select: { locale: true, title: true } },
            },
          },
          variant: { select: { sku: true } },
        },
      },
      user: { select: { name: true } },
    },
  });

  let nextCursor: string | undefined;
  if (rows.length > take) {
    nextCursor = rows.pop()!.id;
  }

  // Flag orders with an in-flight return for THIS org (REQUESTED/APPROVED/
  // SHIPPED) so the seller list can show a "return in progress" hint.
  const pageOrderIds = rows.map((o) => o.id);
  const activeReturns = pageOrderIds.length
    ? await prisma.return.findMany({
        where: {
          orderId: { in: pageOrderIds },
          organizationId,
          status: {
            in: [ReturnStatus.REQUESTED, ReturnStatus.APPROVED, ReturnStatus.SHIPPED],
          },
        },
        select: { orderId: true },
      })
    : [];
  const ordersWithActiveReturn = new Set(activeReturns.map((r) => r.orderId));

  return {
    items: rows.map((order) => ({
      ...order,
      total: Number(order.total),
      exchangeRate: order.exchangeRate != null ? Number(order.exchangeRate) : null,
      hasActiveReturn: ordersWithActiveReturn.has(order.id),
      orgSubtotal: order.items.reduce(
        (sum, item) => sum + Number(item.price) * item.quantity,
        0,
      ),
      items: order.items.map((item) => ({
        ...item,
        price: Number(item.price),
      })),
    })),
    nextCursor,
  };
}

export type OrgOrderListItem = Awaited<
  ReturnType<typeof getOrgOrdersPage>
>["items"][number];

/**
 * Disjunctive status counts for the org order list sidebar. Ignores the status
 * selection itself (so every status stays countable while one is checked) but
 * applies the active search and the org scope, matching the list query.
 */
export async function getOrgOrderStatusCounts({
  organizationId,
  search,
}: {
  organizationId: string;
  search?: string;
}): Promise<Record<string, number>> {
  const orgCondition = { items: { some: { product: { organizationId } } } };

  const searchConditions = search
    ? [
        {
          OR: [
            { id: { contains: search, mode: "insensitive" as const } },
            { user: { name: { contains: search, mode: "insensitive" as const } } },
            {
              items: {
                some: {
                  product: {
                    organizationId,
                    translations: {
                      some: { title: { contains: search, mode: "insensitive" as const } },
                    },
                  },
                },
              },
            },
          ],
        },
      ]
    : [];

  const groups = await prisma.order.groupBy({
    by: ["status"],
    where: { AND: [orgCondition, ...searchConditions] },
    _count: { _all: true },
  });

  const counts: Record<string, number> = {};
  for (const g of groups) counts[g.status] = g._count._all;
  return counts;
}

// ─── Detail ───────────────────────────────────────────────────────────────────

export async function getOrgOrderById(orderId: string, organizationId: string) {
  const order = await prisma.order.findFirst({
    where: {
      id: orderId,
      AND: [{ items: { some: { product: { organizationId } } } }],
    },
    include: {
      items: {
        where: { product: { organizationId } },
        include: {
          product: {
            select: {
              id: true,
              translations: { select: { locale: true, title: true } },
              media: {
                orderBy: { order: "asc" },
                take: 1,
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
      user: { select: { name: true, email: true } },
      paymentTransactions: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          type: true,
          status: true,
          provider: true,
          amount: true,
          currency: true,
          createdAt: true,
          organizationId: true,
        },
      },
    },
  });

  if (!order) return null;

  // Annotate this org's PAYOUT row(s) with how much was clawed back by refunds,
  // mirroring the payouts table: the payout is the seller's NET share, and a
  // return reverses sellerNetAmount(refundedGross). Order-level (manual/external)
  // refunds claw back the whole payout.
  const txns = order.paymentTransactions;
  const orgRefundGross = txns
    .filter((t) => t.type === PaymentTransactionType.REFUND && t.organizationId === organizationId)
    .reduce((sum, t) => sum + t.amount, 0);
  const orderLevelRefunded = txns.some(
    (t) => t.type === PaymentTransactionType.REFUND && t.organizationId === null,
  );

  const paymentTransactions = txns.map((t) => {
    // PAYOUT (seller net) and FEE (platform commission) are both clawed back /
    // credited proportionally when this org's items are refunded. A PAYOUT
    // reverses sellerNetAmount(refundedGross); a FEE credits platformFeeAmount.
    const isPayout = t.type === PaymentTransactionType.PAYOUT && t.organizationId === organizationId;
    const isFee = t.type === PaymentTransactionType.FEE && t.organizationId === organizationId;
    if (!isPayout && !isFee) {
      return { ...t, refundState: "none" as const, reversedNet: 0 };
    }
    const grossBack = isPayout ? sellerNetAmount(orgRefundGross) : platformFeeAmount(orgRefundGross);
    const reversedNet = orderLevelRefunded ? t.amount : Math.min(t.amount, grossBack);
    const refundState =
      reversedNet <= 0 ? ("none" as const) : reversedNet >= t.amount ? ("full" as const) : ("partial" as const);
    return { ...t, refundState, reversedNet };
  });

  return {
    ...order,
    paymentTransactions,
    total: Number(order.total),
    exchangeRate: order.exchangeRate != null ? Number(order.exchangeRate) : null,
    orgSubtotal: order.items.reduce(
      (sum, item) => sum + Number(item.price) * item.quantity,
      0,
    ),
    items: order.items.map((item) => ({
      ...item,
      price: Number(item.price),
    })),
  };
}

export type OrgOrderDetail = NonNullable<
  Awaited<ReturnType<typeof getOrgOrderById>>
>;