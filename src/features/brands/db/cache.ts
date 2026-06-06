import { revalidatePath, revalidateTag } from "next/cache";
import { CacheTags } from "@/lib/cache/tags";

export function revalidateBrandCache(brandId: string) {
  revalidateTag(CacheTags.brands.all(), "max");
  revalidateTag(CacheTags.brands.byId(brandId), "max");

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