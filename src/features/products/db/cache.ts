import { revalidatePath, revalidateTag, updateTag } from "next/cache";
import { CacheTags } from "@/lib/cache/tags";

/**
 * Everything a product mutation busts apart from the two org-scoped admin tags.
 * Those are the only part that differs between the Server Action and the Route
 * Handler variant below, so they stay at the call site.
 */
function revalidateProductSharedCache(productId: string) {
  // Public storefront caches: the actor isn't the one reading these next,
  // so eventual consistency is fine here.
  revalidateTag(CacheTags.products.publicAll(), "max");
  revalidateTag(CacheTags.products.publicById(productId), "max");
  // Admin brand/category lists embed a product count via Prisma `_count`,
  // so any product mutation needs to bust their caches too - otherwise the
  // count goes stale until the brand/category itself is edited.
  revalidateTag(CacheTags.brands.all(), "max");
  revalidateTag(CacheTags.categories.all(), "max");

  // Dynamic routes must be revalidated by their route pattern (bracketed
  // params), not a concrete value - passing `/admin/products/<id>/edit`
  // matches nothing, so the page (and its client Router Cache entry) never
  // gets busted, leaving stale data such as the optimistic-lock `version`.
  revalidatePath("/[locale]/admin/products", "page");
  revalidatePath("/[locale]/admin/products/[id]", "page");
  revalidatePath("/[locale]/admin/products/[id]/edit", "page");
  revalidatePath("/[locale]/products", "page");
  revalidatePath("/[locale]/products/[slug]", "page");
  revalidatePath("/[locale]/dashboard/my-products", "page");
  revalidatePath("/[locale]/dashboard/my-products/[id]", "page");
  revalidatePath("/[locale]/dashboard/my-products/[id]/edit", "page");
}

export function revalidateProductCache(orgId: string, productId: string) {
  // updateTag, NOT revalidateTag(tag, "max"): product mutations (including
  // bulk-by-filter) are seller/admin actions and the actor immediately
  // navigates back to the list / reopens the edit page - those reads must
  // see the write. The "max" profile is stale-while-revalidate and can
  // serve the old data once more. Same convention as revalidateBrandCache /
  // revalidateCategoryCache / revalidateAttributeCache / revalidateTagCache.
  //
  // SERVER ACTIONS ONLY. `updateTag` throws outside one - use
  // `revalidateProductCacheFromRoute` from a Route Handler.
  updateTag(CacheTags.products.all(orgId));
  updateTag(CacheTags.products.byId(orgId, productId));

  revalidateProductSharedCache(productId);
}

/**
 * Route Handler variant of `revalidateProductCache`.
 *
 * WHY THIS EXISTS. `updateTag` throws "can only be called from within a Server
 * Action" anywhere else, and the Stripe webhook is a Route Handler. It called
 * the function above (once per product, inside a `forEach`) *after* the order
 * transaction had already committed, so every card checkout wrote its order and
 * then answered Stripe with a 500. Stripe retried, `fulfillOrder` returned the
 * existing order early, and the webhook finally succeeded - which hid the
 * failure behind a ~16s delay while permanently skipping the post-commit work
 * that sits after the invalidation (coupon usage, purchase events). Same trap
 * the currency-rates route documents at src/app/api/internal/currency-rates/route.ts.
 *
 * `{ expire: 0 }` rather than "max": nothing here is read-your-own-writes (the
 * actor is Stripe, not a person navigating), but the "max" profile is
 * stale-while-revalidate and would serve the pre-order stock once more.
 */
export function revalidateProductCacheFromRoute(orgId: string, productId: string) {
  revalidateTag(CacheTags.products.all(orgId), { expire: 0 });
  revalidateTag(CacheTags.products.byId(orgId, productId), { expire: 0 });

  revalidateProductSharedCache(productId);
}

export function revalidateProductHistoryCache(
  orgId: string,
  productId: string,
) {
  // Same read-your-own-writes reasoning as revalidateProductCache above -
  // the admin who just triggered a history-writing change (publish, status,
  // price) is the one who'll immediately open the history tab.
  updateTag(CacheTags.products.byId(orgId, productId));
  updateTag(CacheTags.products.history(orgId, productId));

  revalidatePath("/[locale]/admin/products/[id]/history", "page");
}
