"use server";

import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/core/db/prisma";
import { asLocale } from "@/i18n/config";
import { revalidateUserCache } from "@/features/users/db/cache";

/**
 * Persist the signed-in user's preferred locale to the database. Called by the
 * language switcher alongside the URL change so recipient-targeted emails
 * (role changes, seller order notifications) reach the user in the language
 * they last picked.
 *
 * Returns `{ updated }` so the caller (LocaleSync) can detect the Clerk
 * webhook race - if `false`, the User row doesn't exist in our DB yet
 * (webhook still in flight) and the caller should retry after a short delay.
 * Anonymous callers report `updated: true` to short-circuit any retry loop.
 */
export async function syncUserLocale(
  locale: string,
): Promise<{ updated: boolean }> {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) return { updated: true };

  const valid = asLocale(locale);

  const result = await prisma.user.updateMany({
    where: { clerkUserId, deletedAt: null },
    data: { locale: valid },
  });

  if (result.count > 0) {
    const user = await prisma.user.findUnique({
      where: { clerkUserId },
      select: { id: true },
    });
    if (user) revalidateUserCache(user.id, clerkUserId);
    return { updated: true };
  }

  return { updated: false };
}