"use client";

import { useParams } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { productMediaCountHint } from "@/features/products/productPageHint";

/**
 * Gallery items drawn when nothing recorded the real count (a hard load, a
 * link from the cart or an order). Measured on the staging catalogue
 * (2026-11-13): 61% of products have two or more items, and two is the most
 * common count, so the strip is drawn with two thumbnails.
 */
const DEFAULT_MEDIA_COUNT = 2;

/**
 * <ProductImageCarousel> box for box: a `space-y-3` root holding the h-96 main
 * frame and, for two or more items, the `flex gap-2 flex-wrap` strip of 64px
 * thumbnails (one per item, so it wraps where the real one wraps). The count
 * comes from `productPageHint`, recorded by the link that started the
 * navigation.
 */
export function ProductGallerySkeleton({
  param = "slug",
  defaultCount = DEFAULT_MEDIA_COUNT,
}: {
  /** The route param the hint is keyed by: the storefront's `slug`, the
   *  dashboard and admin detail pages' product `id`. */
  param?: "slug" | "id";
  defaultCount?: number;
} = {}) {
  const params = useParams<{ slug?: string; id?: string }>();
  const count = productMediaCountHint(params?.[param]) ?? defaultCount;

  return (
    <div className="space-y-3">
      <Skeleton className="h-96 w-full rounded-lg" />
      {count > 1 && (
        <div className="flex gap-2 flex-wrap">
          {Array.from({ length: count }, (_, i) => (
            <Skeleton key={i} className="h-16 w-16 shrink-0 rounded" />
          ))}
        </div>
      )}
    </div>
  );
}
