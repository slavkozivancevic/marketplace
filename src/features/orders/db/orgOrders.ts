import { prisma } from "@/core/db/prisma";
import { Prisma, OrderStatus } from "@/generated/prisma/client";

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

  return {
    items: rows.map((order) => ({
      ...order,
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
              optionValues: {
                // Pull each option's per-locale value map so the order page can
                // localize the variant label instead of showing raw values.
                include: {
                  option: {
                    select: {
                      translations: { select: { locale: true, values: true } },
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
    },
  });

  if (!order) return null;

  return {
    ...order,
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