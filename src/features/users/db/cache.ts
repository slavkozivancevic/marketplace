import { revalidateTag } from "next/cache";
import { CacheTags } from "@/lib/cache/tags";

export function revalidateUserCache(userId: string, clerkId?: string) {
  revalidateTag(CacheTags.users.all(), "max");
  revalidateTag(CacheTags.users.byId(userId), "max");
  if (clerkId) {
    revalidateTag(CacheTags.users.byClerkId(clerkId), "max");
  }
}
