import { revalidatePath, revalidateTag } from "next/cache";
import { CacheTags } from "@/lib/cache/tags";

export function revalidateReviewCache(productId: string, userId?: string) {
  revalidateTag(CacheTags.reviews.byProduct(productId), "max");
  revalidateTag(CacheTags.products.publicById(productId), "max");

  if (userId) {
    revalidateTag(CacheTags.reviews.userReview(productId, userId), "max");
  }

  // The public product page is a dynamic [slug] route, so it must be
  // revalidated by its pattern - a concrete product id matches no route.
  revalidatePath("/[locale]/products/[slug]", "page");
}