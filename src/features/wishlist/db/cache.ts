import { revalidatePath, updateTag } from "next/cache";
import { CacheTags } from "@/lib/cache/tags";

export function revalidateWishlistCache(userId: string) {
  // updateTag, NOT revalidateTag(tag, "max"): the toggle is a user-facing
  // server action and the very next request (user clicks the heart, then
  // immediately opens /wishlist) must read its own write. revalidateTag with
  // a profile is stale-while-revalidate - it can serve the OLD wishlist once
  // more, which made a just-removed product reappear and let a second toggle
  // silently re-add it.
  updateTag(CacheTags.wishlist.byUser(userId));
  revalidatePath("/[locale]/wishlist", "page");
  revalidatePath("/[locale]/products", "page");
}
