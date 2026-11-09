import { revalidateTag, updateTag } from "next/cache";
import { CacheTags } from "@/lib/cache/tags";

export function revalidateUserCache(userId: string, clerkId?: string) {
  revalidateTag(CacheTags.users.all(), "max");
  revalidateTag(CacheTags.users.byId(userId), "max");
  if (clerkId) {
    revalidateTag(CacheTags.users.byClerkId(clerkId), "max");
  }
}

/**
 * Read-your-own-writes for the signed-in user's own row, from a Server Action
 * only (`updateTag` throws anywhere else).
 *
 * `revalidateUserCache` is stale-while-revalidate, so the next read still gets
 * the old entry. The dashboard layout reads the active org from that cache
 * (`fetchLayoutUser`), and after an org switch its `router.refresh()` is
 * exactly that next read: the shell rendered the OLD org - the switcher snapped
 * back, `ActiveOrgProvider` kept the old React Query keys - while the page and
 * every API route, which read the database, already served the NEW org. The
 * list then showed the new org's rows (or "No products yet") under the old
 * org's name, and opening a product said "Wrong organization context".
 */
export function refreshOwnUserCache(userId: string, clerkId: string) {
  revalidateUserCache(userId, clerkId);
  updateTag(CacheTags.users.byId(userId));
  updateTag(CacheTags.users.byClerkId(clerkId));
}
