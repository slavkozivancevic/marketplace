import { revalidatePath, updateTag } from "next/cache";
import { CacheTags } from "@/lib/cache/tags";

/**
 * Busts everything a trust-point mutation touches.
 *
 * `updateTag`, not `revalidateTag(tag, "max")`: these are admin actions and the
 * admin goes straight back to the list (or to the storefront to look at the
 * strip they just changed), so those reads must see the write. The "max"
 * profile is stale-while-revalidate and would serve the old strip once more.
 * Server Actions only - there is no Route Handler that writes these.
 */
export function revalidateTrustPointCache(trustPointId: string) {
  updateTag(CacheTags.trustPoints.all());
  updateTag(CacheTags.trustPoints.byId(trustPointId));

  // Dynamic routes must be revalidated by their route pattern (bracketed
  // params), not a concrete value - a literal id matches nothing, so neither
  // the page nor its client Router Cache entry gets busted.
  revalidatePath("/[locale]/admin/trust-points", "page");
  revalidatePath("/[locale]/admin/trust-points/[id]/edit", "page");
  // The storefront surfaces that render the strip.
  revalidatePath("/[locale]", "page");
  revalidatePath("/[locale]/cart", "page");
}
