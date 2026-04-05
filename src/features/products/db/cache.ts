import { revalidatePath, revalidateTag } from "next/cache";
import { CacheTags } from "@/lib/cache/tags";

export function revalidateProductCache(orgId: string, productId: string) {
  revalidateTag(CacheTags.products.all(orgId), "max");
  revalidateTag(CacheTags.products.byId(orgId, productId), "max");
  revalidateTag(CacheTags.products.publicAll(), "max");
  revalidateTag(CacheTags.products.publicById(productId), "max");

  revalidatePath("/admin/products");
  revalidatePath(`/admin/products/${productId}`);
  revalidatePath(`/admin/products/${productId}/edit`);
  revalidatePath("/products");
  revalidatePath(`/products/${productId}`);
  revalidatePath("/dashboard/my-products");
  revalidatePath(`/dashboard/my-products/${productId}`);
}

export function revalidateProductHistoryCache(
  orgId: string,
  productId: string,
) {
  revalidateTag(CacheTags.products.byId(orgId, productId), "max");
  revalidateTag(CacheTags.products.history(orgId, productId), "max");

  revalidatePath(`/admin/products/${productId}/history`);
}
