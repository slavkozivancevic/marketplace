import { revalidatePath, revalidateTag } from "next/cache";
import { CacheTags } from "@/lib/cache/tags";

export function revalidateBrandCache(brandId: string) {
  revalidateTag(CacheTags.brands.all(), "max");
  revalidateTag(CacheTags.brands.byId(brandId), "max");

  revalidatePath("/admin/brands");
  revalidatePath(`/admin/brands/${brandId}/edit`);
}