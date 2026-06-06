import { revalidatePath, revalidateTag } from "next/cache";
import { CacheTags } from "@/lib/cache/tags";

export function revalidateWishlistCache(userId: string) {
  revalidateTag(CacheTags.wishlist.byUser(userId), "max");
  revalidatePath("/[locale]/wishlist", "page");
  revalidatePath("/[locale]/products", "page");
}
