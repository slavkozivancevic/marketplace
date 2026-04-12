import { prisma } from "@/core/db/prisma";
import { Prisma } from "@/generated/prisma/client";
import { SerializedProductListItem } from "@/types/types";

type SortField = "createdAt" | "price" | "title";
type SortOrder = "asc" | "desc";

/**
 * Cross-tenant public product feed (status PUBLISHED, not deleted).
 *
 * Cursor-paginated using the `take + 1` trick. Numbers are serialized to
 * primitive numbers for safe transport across the SSR/client boundary.
 */
export async function getPublicProductsPage({
  take,
  cursor,
  search,
  sortBy = "createdAt",
  sortOrder = "desc",
}: {
  take: number;
  cursor?: string;
  search?: string;
  sortBy?: SortField;
  sortOrder?: SortOrder;
}): Promise<{ items: SerializedProductListItem[]; nextCursor?: string }> {
  const where: Prisma.ProductWhereInput = {
    status: "PUBLISHED",
    deletedAt: null,
  };

  if (search) {
    where.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
    ];
  }

  const orderBy: Prisma.ProductOrderByWithRelationInput[] = [
    { [sortBy]: sortOrder },
    { id: "asc" },
  ];

  const rows = await prisma.product.findMany({
    where,
    orderBy,
    take: take + 1,
    cursor: cursor ? { id: cursor } : undefined,
    skip: cursor ? 1 : 0,
    include: {
      images: { orderBy: { order: "asc" }, take: 5 },
    },
  });

  let nextCursor: string | undefined;
  if (rows.length > take) {
    const next = rows.pop();
    nextCursor = next?.id;
  }

  const items: SerializedProductListItem[] = rows.map((p) => ({
    ...p,
    price: Number(p.price),
  }));

  return { items, nextCursor };
}
