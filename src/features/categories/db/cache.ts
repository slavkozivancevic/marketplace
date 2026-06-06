import { revalidatePath, revalidateTag } from "next/cache";
import { CacheTags } from "@/lib/cache/tags";

export function revalidateCategoryCache(categoryId: string) {
  revalidateTag(CacheTags.categories.all(), "max");
  revalidateTag(CacheTags.categories.byId(categoryId), "max");

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