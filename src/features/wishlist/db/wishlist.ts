import { cacheTag } from "next/cache";
import { prisma } from "@/core/db/prisma";
import { CacheTags } from "@/lib/cache/tags";
import { SerializedProductListItem } from "@/types/types";

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

  const items = await prisma.wishlist.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: {
      product: {
        include: {
          translations: true,
          media: { orderBy: { order: "asc" }, take: 5 },
          brand: { select: { id: true, logoUrl: true, logoUrlDark: true, logoBackdrop: true, logoBackdropDark: true, translations: true } },
        },
      },
    },
  });

  return items
    .filter((i) => i.product.status === "PUBLISHED" && !i.product.deletedAt)
    .map((i) => ({
      ...i.product,
      price: i.product.price,
      compareAtPrice: i.product.compareAtPrice,
      costPrice: i.product.costPrice,
    }));
}