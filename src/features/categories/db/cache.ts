import { revalidatePath, revalidateTag } from "next/cache";
import { CacheTags } from "@/lib/cache/tags";

export function revalidateCategoryCache(categoryId: string) {
  revalidateTag(CacheTags.categories.all(), "max");
  revalidateTag(CacheTags.categories.byId(categoryId), "max");

  revalidatePath("/admin/categories");
  revalidatePath(`/admin/categories/${categoryId}/edit`);
  revalidatePath("/");
}