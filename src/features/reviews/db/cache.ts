import { revalidatePath, revalidateTag } from "next/cache";
import { CacheTags } from "@/lib/cache/tags";

export function revalidateReviewCache(productId: string, userId?: string) {
  revalidateTag(CacheTags.reviews.byProduct(productId), "max");
  revalidateTag(CacheTags.products.publicById(productId), "max");

  if (userId) {
    revalidateTag(CacheTags.reviews.userReview(productId, userId), "max");
  }

  revalidatePath(`/products/${productId}`);
}
