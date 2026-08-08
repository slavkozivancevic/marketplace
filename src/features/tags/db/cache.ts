import { revalidatePath, revalidateTag, updateTag } from "next/cache";
import { CacheTags } from "@/lib/cache/tags";

export function revalidateTagCache(tagId: string) {
  // updateTag, NOT revalidateTag(tag, "max"): tag mutations are admin actions
  // and the admin immediately navigates back to the list / reopens the edit
  // page - those reads must see the write. The "max" profile is
  // stale-while-revalidate and can serve the old name once more.
  updateTag(CacheTags.tags.all());
  updateTag(CacheTags.tags.byId(tagId));

  // Dynamic routes must be revalidated by their route pattern (bracketed
  // params), not a concrete value - passing a literal id matches nothing, so
  // the page and its client Router Cache entry never get busted.
  revalidatePath("/[locale]/admin/tags", "page");
  revalidatePath("/[locale]/admin/tags/[id]", "page");
  revalidatePath("/[locale]/admin/tags/[id]/edit", "page");
}

/**
 * Busts the caches of every product tagged with a given tag. A tag's name is
 * embedded in product searchText and (once rendered) product detail pages,
 * which cache under PRODUCT tags - not tag tags - so renaming a tag would
 * otherwise leave storefront product pages showing the stale label.
 */
export function revalidateTagProductCaches(
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

  revalidatePath("/[locale]/products", "page");
  revalidatePath("/[locale]/products/[slug]", "page");
}
