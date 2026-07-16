import { revalidatePath, revalidateTag, updateTag } from "next/cache";
import { CacheTags } from "@/lib/cache/tags";

export function revalidateBrandCache(brandId: string) {
  // updateTag, NOT revalidateTag(tag, "max"): brand mutations are admin
  // actions and the admin immediately navigates back to the list / reopens
  // the edit page - those reads must see the write. The "max" profile is
  // stale-while-revalidate and can serve the old name once more.
  updateTag(CacheTags.brands.all());
  updateTag(CacheTags.brands.byId(brandId));

  // Dynamic routes must be revalidated by their route pattern (bracketed
  // params), not a concrete value - passing a literal id matches nothing,
  // so the page and its client Router Cache entry never get busted.
  revalidatePath("/[locale]/admin/brands", "page");
  revalidatePath("/[locale]/admin/brands/[id]", "page");
  revalidatePath("/[locale]/admin/brands/[id]/edit", "page");
  // Public-facing brand pages also embed brand data, so bust them too.
  revalidatePath("/[locale]/brands", "page");
  revalidatePath("/[locale]/brands/[slug]", "page");
}

/**
 * Busts the caches of every product that references a brand. A brand's visual
 * fields (logo, name) are embedded in product payloads, which cache under
 * PRODUCT tags - not brand tags - so editing a brand's logo would otherwise
 * leave storefront product pages, listings and admin/seller views showing the
 * stale brand (e.g. fallback initials instead of the new logo).
 */
export function revalidateBrandProductCaches(
  products: readonly { id: string; organizationId: string }[],
) {
  revalidateTag(CacheTags.products.publicAll(), "max");

  const orgs = new Set<string>();
  for (const p of products) {
    revalidateTag(CacheTags.products.publicById(p.id), "max");
    revalidateTag(CacheTags.products.byId(p.organizationId, p.id), "max");
    orgs.add(p.organizationId);
  }
  for (const orgId of orgs) {
    revalidateTag(CacheTags.products.all(orgId), "max");
  }

  // Route-level caches for product pages that render the brand chip.
  revalidatePath("/[locale]/products", "page");
  revalidatePath("/[locale]/products/[slug]", "page");
}