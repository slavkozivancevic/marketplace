import { revalidatePath, revalidateTag } from "next/cache";
import { CacheTags } from "@/lib/cache/tags";

export function revalidateWishlistCache(userId: string) {
  revalidateTag(CacheTags.wishlist.byUser(userId), "max");
  revalidatePath("/wishlist");
  revalidatePath("/products");
}
