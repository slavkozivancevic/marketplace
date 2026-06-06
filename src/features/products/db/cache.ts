import { revalidatePath, revalidateTag } from "next/cache";
import { CacheTags } from "@/lib/cache/tags";

export function revalidateProductCache(orgId: string, productId: string) {
  revalidateTag(CacheTags.products.all(orgId), "max");
  revalidateTag(CacheTags.products.byId(orgId, productId), "max");
  revalidateTag(CacheTags.products.publicAll(), "max");
  revalidateTag(CacheTags.products.publicById(productId), "max");
  // Admin brand/category lists embed a product count via Prisma `_count`,
  // so any product mutation needs to bust their caches too - otherwise the
  // count goes stale until the brand/category itself is edited.
  revalidateTag(CacheTags.brands.all(), "max");
  revalidateTag(CacheTags.categories.all(), "max");

  // Dynamic routes must be revalidated by their route pattern (bracketed
  // params), not a concrete value - passing `/admin/products/<id>/edit`
  // matches nothing, so the page (and its client Router Cache entry) never
  // gets busted, leaving stale data such as the optimistic-lock `version`.
  revalidatePath("/[locale]/admin/products", "page");
  revalidatePath("/[locale]/admin/products/[id]", "page");
  revalidatePath("/[locale]/admin/products/[id]/edit", "page");
  revalidatePath("/[locale]/products", "page");
  revalidatePath("/[locale]/products/[slug]", "page");
  revalidatePath("/[locale]/dashboard/my-products", "page");
  revalidatePath("/[locale]/dashboard/my-products/[id]", "page");
  revalidatePath("/[locale]/dashboard/my-products/[id]/edit", "page");
}

export function revalidateProductHistoryCache(
  orgId: string,
  productId: string,
) {
  revalidateTag(CacheTags.products.byId(orgId, productId), "max");
  revalidateTag(CacheTags.products.history(orgId, productId), "max");

  revalidatePath("/[locale]/admin/products/[id]/history", "page");
}
