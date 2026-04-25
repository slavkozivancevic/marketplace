import { cacheTag } from "next/cache";
import { prisma } from "@/core/db/prisma";
import { CacheTags } from "@/lib/cache/tags";

export interface UserProfile {
  name: string | null;
  imageUrl: string | null;
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
    select: { id: true, name: true, imageUrl: true },
  });

  return Object.fromEntries(
    users.map((u) => [u.id, { name: u.name, imageUrl: u.imageUrl }])
  );
}