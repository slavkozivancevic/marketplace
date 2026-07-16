import { revalidatePath, updateTag } from "next/cache";
import { CacheTags } from "@/lib/cache/tags";

export function revalidateAttributeCache(attributeId: string) {
  // updateTag, NOT revalidateTag(tag, "max"): attribute mutations are admin
  // actions and the admin's next read (list / edit page) must see the write;
  // the "max" profile is stale-while-revalidate and can serve stale once.
  updateTag(CacheTags.attributes.all());
  updateTag(CacheTags.attributes.byId(attributeId));
  // Category assignment + product capture surfaces embed attribute data, and
  // the public facet sidebars derive from it - bust them all.
  revalidatePath("/[locale]/admin/attributes", "page");
  revalidatePath("/[locale]/admin/attributes/[id]/edit", "page");
  revalidatePath("/[locale]/admin/categories/[id]/edit", "page");
  revalidatePath("/[locale]/categories/[slug]", "page");
  revalidatePath("/[locale]/products", "page");
}
