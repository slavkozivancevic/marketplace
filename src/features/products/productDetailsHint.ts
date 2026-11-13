import type { BasicInfoSource } from "@/features/products/components/ProductBasicInfoCard";

/**
 * The admin/dashboard product detail page's loading state gets no data, but
 * the list row that was clicked holds everything its first card and its title
 * show. The row records itself here, keyed by product id; the skeleton draws
 * the real header and card from it. Module state only - never storage - so a
 * server-rendered skeleton (empty map) and its hydration always agree.
 */
const byId = new Map<string, BasicInfoSource>();

export function rememberProductDetails(id: string, product: BasicInfoSource): void {
  if (id) byId.set(id, product);
}

/** The product recorded for this id, or `undefined` when no row recorded it. */
export function productDetailsHint(id: string | undefined): BasicInfoSource | undefined {
  return id ? byId.get(id) : undefined;
}
