import { revalidatePath, revalidateTag } from "next/cache";
import { CacheTags } from "@/lib/cache/tags";

export function revalidateAttributeCache(attributeId: string) {
  revalidateTag(CacheTags.attributes.all(), "max");
  revalidateTag(CacheTags.attributes.byId(attributeId), "max");
  // Category assignment + product capture surfaces embed attribute data, and
  // the public facet sidebars derive from it - bust them all.
  revalidatePath("/[locale]/admin/attributes", "page");
  revalidatePath("/[locale]/admin/attributes/[id]/edit", "page");
  revalidatePath("/[locale]/admin/categories/[id]/edit", "page");
  revalidatePath("/[locale]/categories/[slug]", "page");
  revalidatePath("/[locale]/products", "page");
}
