import { cacheTag } from "next/cache";
import { prisma } from "@/core/db/prisma";
import { CacheTags } from "@/lib/cache/tags";

export interface UserProfile {
  /** Null for a deleted account - its name is gone, not just hidden. */
  name: string | null;
  imageUrl: string | null;
  /**
   * The account was deleted. The UI shows a localized "Deleted account"
   * (chatDisplayName) instead of the English placeholder the row keeps for
   * orders and the audit log, and never the name it used to have.
   */
  deleted: boolean;
}

export async function getUserProfilesById(
  ids: string[]
): Promise<Record<string, UserProfile>> {
  "use cache";
  for (const id of ids) {
    cacheTag(CacheTags.users.byId(id));
  }

  const users = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, imageUrl: true, deletedAt: true },
  });

  return Object.fromEntries(
    users.map((u) => {
      const deleted = u.deletedAt !== null;
      return [u.id, { name: deleted ? null : u.name, imageUrl: deleted ? null : u.imageUrl, deleted }];
    })
  );
}
