import { prisma } from "@/core/db/prisma";
import { cacheTag } from "next/cache";
import { CacheTags } from "@/lib/cache/tags";
import { Prisma, InteractionType } from "@/generated/prisma/client";
import type { SerializedProductListItem } from "@/types/types";
import { listItemInclude, serializeListItem } from "@/features/products/db/publicProducts";

// Card projection for the related / recently-viewed / frequently-bought strips.
// Uses the shared storefront card shape so these tiles render the exact same
// <ProductCard> as the grid and wishlist - just one media frame (a static
// still; the shared card only cycles when given multiple frames).
const CARD_INCLUDE = {
  ...listItemInclude,
  media: { orderBy: { order: "asc" }, take: 1 },
} satisfies Prisma.ProductInclude;

type CardRow = Prisma.ProductGetPayload<{ include: typeof CARD_INCLUDE }>;

/** Re-sorts fetched products into the given id order (DB findMany is unordered). */
function orderByIds(rows: CardRow[], ids: string[]): SerializedProductListItem[] {
  const byId = new Map(rows.map((r) => [r.id, r]));
  return ids
    .map((id) => byId.get(id))
    .filter((p): p is CardRow => !!p)
    .map(serializeListItem);
}

export type InteractionIdentity = { userId?: string; sessionId?: string };

const VIEW_DEDUPE_WINDOW_MS = 30 * 60 * 1000;

/**
 * Records a VIEW or ADD_TO_CART event. Best-effort: never throws (a logging
 * failure must not affect the page or the cart). VIEW events are deduped within
 * a 30-minute window per identity so refreshes/scrolls don't flood the table.
 */
export async function recordInteraction(params: {
  type: "VIEW" | "ADD_TO_CART";
  productId: string;
  identity: InteractionIdentity;
}): Promise<void> {
  const { type, productId, identity } = params;
  const { userId, sessionId } = identity;
  if (!userId && !sessionId) return;

  try {
    if (type === "VIEW") {
      const since = new Date(Date.now() - VIEW_DEDUPE_WINDOW_MS);
      const recent = await prisma.interactionEvent.findFirst({
        where: {
          type: "VIEW",
          productId,
          createdAt: { gte: since },
          // Dedupe on the strongest identity we have.
          ...(userId ? { userId } : { sessionId }),
        },
        select: { id: true },
      });
      if (recent) return;
    }

    await prisma.interactionEvent.create({
      data: { type, productId, userId, sessionId },
    });
  } catch (err) {
    console.error("[interactions] recordInteraction failed", err);
  }
}

/**
 * Records one PURCHASE event per purchased product. Best-effort - called after
 * the order transaction commits, so a failure here never affects the order.
 */
export async function recordPurchaseEvents(params: {
  userId: string;
  orderId: string;
  productIds: string[];
}): Promise<void> {
  const ids = [...new Set(params.productIds)];
  if (ids.length === 0) return;
  try {
    await prisma.interactionEvent.createMany({
      data: ids.map((productId) => ({
        type: InteractionType.PURCHASE,
        productId,
        userId: params.userId,
        orderId: params.orderId,
      })),
    });
  } catch (err) {
    console.error("[interactions] recordPurchaseEvents failed", err);
  }
}

/**
 * Most recently viewed products for an identity, newest first, excluding the
 * current product. Personalized -> never cached (the API route serves it live).
 */
export async function getRecentlyViewed(params: {
  identity: InteractionIdentity;
  excludeProductId?: string;
  limit?: number;
}): Promise<SerializedProductListItem[]> {
  const { identity, excludeProductId, limit = 12 } = params;
  const { userId, sessionId } = identity;
  if (!userId && !sessionId) return [];

  // Latest VIEW timestamp per product, newest first. Overfetch so unpublished /
  // deleted products can be filtered out without shrinking the result below limit.
  const grouped = await prisma.interactionEvent.groupBy({
    by: ["productId"],
    where: {
      type: "VIEW",
      ...(userId ? { userId } : { sessionId }),
      ...(excludeProductId ? { productId: { not: excludeProductId } } : {}),
    },
    _max: { createdAt: true },
    orderBy: { _max: { createdAt: "desc" } },
    take: limit * 2,
  });
  const ids = grouped.map((g) => g.productId);
  if (ids.length === 0) return [];

  const rows = await prisma.product.findMany({
    where: { id: { in: ids }, status: "PUBLISHED", deletedAt: null },
    include: CARD_INCLUDE,
  });

  return orderByIds(rows, ids).slice(0, limit);
}

/**
 * "Customers who bought this also bought" - co-occurrence from the authoritative
 * OrderItem table (not the event log): other products appearing in orders that
 * also contain this product, ranked by frequency. Cached like related products.
 */
export async function getFrequentlyBoughtTogether(
  productId: string,
  limit = 12,
): Promise<SerializedProductListItem[]> {
  "use cache";
  cacheTag(CacheTags.products.publicAll());
  cacheTag(CacheTags.products.publicById(productId));

  const orderRows = await prisma.orderItem.findMany({
    where: { productId },
    select: { orderId: true },
  });
  const orderIds = [...new Set(orderRows.map((r) => r.orderId))];
  if (orderIds.length === 0) return [];

  const grouped = await prisma.orderItem.groupBy({
    by: ["productId"],
    where: { orderId: { in: orderIds }, productId: { not: productId } },
    _count: { productId: true },
    orderBy: { _count: { productId: "desc" } },
    take: limit * 2,
  });
  const ids = grouped.map((g) => g.productId);
  if (ids.length === 0) return [];

  const rows = await prisma.product.findMany({
    where: { id: { in: ids }, status: "PUBLISHED", deletedAt: null },
    include: CARD_INCLUDE,
  });

  return orderByIds(rows, ids).slice(0, limit);
}
