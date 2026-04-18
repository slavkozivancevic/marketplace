"use server";

import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/core/db/prisma";
import { toggleWishlistItem } from "../db/wishlist";
import { revalidateWishlistCache } from "../db/cache";
import { UnauthenticatedError } from "@/features/common/errors/domainErrors";

async function resolveUserId(): Promise<string> {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) throw new UnauthenticatedError();

  const user = await prisma.user.findUnique({
    where: { clerkUserId },
    select: { id: true },
  });

  if (!user) throw new UnauthenticatedError();
  return user.id;
}

export async function toggleWishlist(
  productId: string,
): Promise<{ isWishlisted: boolean } | { error: string }> {
  try {
    const userId = await resolveUserId();
    const isWishlisted = await toggleWishlistItem(userId, productId);
    revalidateWishlistCache(userId);
    return { isWishlisted };
  } catch (e) {
    if (e instanceof UnauthenticatedError) return { error: "unauthenticated" };
    return { error: "Failed to update wishlist" };
  }
}
