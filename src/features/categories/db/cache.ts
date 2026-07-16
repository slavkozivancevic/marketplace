import { revalidatePath, updateTag } from "next/cache";
import { CacheTags } from "@/lib/cache/tags";

export function revalidateCategoryCache(categoryId: string) {
  // updateTag, NOT revalidateTag(tag, "max"): category mutations are admin
  // actions and the admin immediately navigates back to the list / reopens
  // the edit page - those reads must see the write. The "max" profile is
  // stale-while-revalidate and can serve the old name once more.
  updateTag(CacheTags.categories.all());
  updateTag(CacheTags.categories.byId(categoryId));

  // Routes live under /[locale]/... so the dynamic locale segment must be
  // included; the "page" type tells Next to match the pattern across every
  // resolved locale rather than treating [locale] as a literal segment.
  // Dynamic id segments must likewise be bracketed - a concrete value
  // matches no route, leaving the page (and its Router Cache) stale.
  revalidatePath("/[locale]/admin/categories", "page");
  revalidatePath("/[locale]/admin/categories/[id]", "page");
  revalidatePath("/[locale]/admin/categories/[id]/edit", "page");
  revalidatePath("/[locale]/admin/products/bulk", "page");
  // Public-facing category pages also embed category data, so bust them too.
  revalidatePath("/[locale]/categories", "page");
  revalidatePath("/[locale]/categories/[slug]", "page");
  revalidatePath("/[locale]", "page");
}