import { prisma } from "@/core/db/prisma";
import { Prisma, ReviewStatus } from "@/generated/prisma/client";

/**
 * Cursor-paginated review moderation queue for the admin view. Filters by
 * moderation status and free-text (comment, author name/email). Keyset paging:
 * fetch take+1, pop the extra into `nextCursor`, stable [createdAt, id] order.
 */
export async function getReviewsPage({
  take,
  cursor,
  search,
  status,
  sortOrder = "desc",
}: {
  take: number;
  cursor?: string;
  search?: string;
  status?: ReviewStatus;
  sortOrder?: "asc" | "desc";
}) {
  const and: Prisma.ProductReviewWhereInput[] = [];
  if (status) and.push({ status });
  if (search) {
    and.push({
      OR: [
        { comment: { contains: search, mode: "insensitive" } },
        { user: { name: { contains: search, mode: "insensitive" } } },
        { user: { email: { contains: search, mode: "insensitive" } } },
      ],
    });
  }
  const where: Prisma.ProductReviewWhereInput = and.length ? { AND: and } : {};

  const rows = await prisma.productReview.findMany({
    where,
    orderBy: [{ createdAt: sortOrder }, { id: "asc" }],
    take: take + 1,
    cursor: cursor ? { id: cursor } : undefined,
    skip: cursor ? 1 : 0,
    select: {
      id: true,
      rating: true,
      comment: true,
      status: true,
      moderationReason: true,
      createdAt: true,
      moderatedAt: true,
      user: { select: { id: true, name: true, email: true, imageUrl: true } },
      product: {
        select: {
          id: true,
          translations: { select: { locale: true, title: true, slug: true } },
        },
      },
    },
  });

  let nextCursor: string | undefined;
  if (rows.length > take) nextCursor = rows.pop()!.id;

  return { items: rows, nextCursor };
}

export type AdminReviewItem = Awaited<
  ReturnType<typeof getReviewsPage>
>["items"][number];

/** Count of reviews per moderation status, for the queue's filter badges. */
export async function getReviewModerationCounts(): Promise<
  Record<ReviewStatus, number>
> {
  const grouped = await prisma.productReview.groupBy({
    by: ["status"],
    _count: { status: true },
  });
  const counts: Record<ReviewStatus, number> = {
    PENDING: 0,
    APPROVED: 0,
    REJECTED: 0,
  };
  for (const row of grouped) counts[row.status] = row._count.status;
  return counts;
}
