"use server";

import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/core/db/prisma";
import { getUserWishlistProductIds, toggleWishlistItem } from "../db/wishlist";
import { revalidateWishlistCache } from "../db/cache";
import { DemoReadOnlyError, UnauthenticatedError } from "@/features/common/errors/domainErrors";
import { isDemoReadOnlyEmail } from "@/features/demo/demoAccounts";

/** `forWrite`: a wishlist is saved per account, and the view-only demo
 *  accounts are shared by every visitor - the next one would find it filled. */
async function resolveUserId({ forWrite = false } = {}): Promise<string> {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) throw new UnauthenticatedError();

  const user = await prisma.user.findUnique({
    where: { clerkUserId },
    select: { id: true, email: true },
  });

  if (!user) throw new UnauthenticatedError();
  if (forWrite && isDemoReadOnlyEmail(user.email)) throw new DemoReadOnlyError();
  return user.id;
}

export async function getWishlistIds(): Promise<string[]> {
  try {
    const userId = await resolveUserId();
    return await getUserWishlistProductIds(userId);
  } catch {
    return [];
  }
}

export async function toggleWishlist(
  productId: string,
): Promise<{ isWishlisted: boolean } | { error: string }> {
  try {
    const userId = await resolveUserId({ forWrite: true });
    const isWishlisted = await toggleWishlistItem(userId, productId);
    revalidateWishlistCache(userId);
    return { isWishlisted };
  } catch (e) {
    if (e instanceof UnauthenticatedError) return { error: "unauthenticated" };
    if (e instanceof DemoReadOnlyError) return { error: "demoReadOnly" };
    return { error: "Failed to update wishlist" };
  }
}