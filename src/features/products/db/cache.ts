import { revalidateTag } from "next/cache";
import { CacheTags } from "@/lib/cache/tags";

export function revalidateProductCache(orgId: string, productId: string) {
  revalidateTag(CacheTags.products.all(orgId), "max");
  revalidateTag(CacheTags.products.byId(orgId, productId), "max");
}

export function revalidateProductHistoryCache(
  orgId: string,
  productId: string,
) {
  revalidateTag(CacheTags.products.byId(orgId, productId), "max");
  revalidateTag(CacheTags.products.history(orgId, productId), "max");
}
