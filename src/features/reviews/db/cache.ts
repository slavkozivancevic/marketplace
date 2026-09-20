import { revalidatePath, updateTag } from "next/cache";
import { CacheTags } from "@/lib/cache/tags";

/**
 * SERVER ACTIONS ONLY. Every writer that reaches this (submit, edit, delete,
 * moderation) is a Server Action; `updateTag` throws anywhere else, so a Route
 * Handler would need the `revalidateTag(tag, { expire: 0 })` variant instead -
 * see revalidateProductCacheFromRoute for the shape and the reason.
 *
 * `updateTag`, not `revalidateTag(tag, "max")`: the author of the review is
 * standing on the product page they just wrote to, and the "max" profile is
 * stale-while-revalidate - it serves the old list once more. That is what made a
 * deleted review sit there until a hard reload: the client refresh re-rendered
 * the page and got the pre-delete cache entry back. Same convention as
 * revalidateProductCache / revalidateBrandCache.
 */
export function revalidateReviewCache(productId: string, userId?: string) {
  updateTag(CacheTags.reviews.byProduct(productId));
  // The page's rating and count come off the product record, which the same
  // transaction recomputed - so it has to move with the list.
  updateTag(CacheTags.products.publicById(productId));

  if (userId) {
    updateTag(CacheTags.reviews.userReview(productId, userId));
  }

  // The public product page is a dynamic [slug] route, so it must be
  // revalidated by its pattern - a concrete product id matches no route.
  revalidatePath("/[locale]/products/[slug]", "page");
}
