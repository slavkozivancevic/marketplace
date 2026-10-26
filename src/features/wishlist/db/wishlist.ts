import { cacheTag } from "next/cache";
import { prisma } from "@/core/db/prisma";
import { CacheTags } from "@/lib/cache/tags";
import {
  listItemInclude,
  serializeListItem,
  tagSellerTerms,
} from "@/features/products/db/publicProducts";
import { SerializedProductListItem } from "@/types/types";
import { ensurePricesCurrent } from "@/features/pricing/db/roll";
import { expireAtNextPriceChange } from "@/features/pricing/db/projection";

export async function getUserWishlistProductIds(userId: string): Promise<string[]> {
  "use cache";
  cacheTag(CacheTags.wishlist.byUser(userId));

  const items = await prisma.wishlist.findMany({
    where: { userId },
    select: { productId: true },
    orderBy: { createdAt: "desc" },
  });
  return items.map((i) => i.productId);
}

export async function toggleWishlistItem(
  userId: string,
  productId: string,
): Promise<boolean> {
  const existing = await prisma.wishlist.findUnique({
    where: { userId_productId: { userId, productId } },
    select: { userId: true },
  });

  if (existing) {
    await prisma.wishlist.delete({
      where: { userId_productId: { userId, productId } },
    });
    return false;
  }

  await prisma.wishlist.create({ data: { userId, productId } });
  return true;
}

export async function getWishlistProducts(
  userId: string,
): Promise<SerializedProductListItem[]> {
  "use cache";
  cacheTag(CacheTags.wishlist.byUser(userId));

  await ensurePricesCurrent();
  const items = await prisma.wishlist.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: {
      // The shared card include, not a hand-rolled copy of it: this list used
      // to spell out its own relations, which is how it would have been the one
      // surface whose cards knew nothing about delivery.
      product: {
        include: {
          ...listItemInclude,
          media: { orderBy: [{ order: "asc" }, { id: "asc" }], take: 5 },
        },
      },
    },
  });

  const visible = items.filter(
    (i) => i.product.status === "PUBLISHED" && !i.product.deletedAt,
  );

  // The cards carry each seller's delivery terms, so a seller changing theirs
  // has to drop this list too - the wishlist tag alone only covers the user
  // adding or removing an item, and `cacheLife("max")` never expires on its own.
  tagSellerTerms(visible.map((i) => i.product));
  // A wished-for item going on (or off) promo must show without a new visit.
  expireAtNextPriceChange(visible.map((i) => i.product));

  return visible.map((i) => serializeListItem(i.product));
}