"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import { useTranslations } from "next-intl";
import {
  RelatedProductsCarousel,
  type RelatedProduct,
} from "@/features/products/components/RelatedProductsCarousel";

/**
 * Personalized "Recently viewed" strip. Fetched client-side (it depends on the
 * visitor's cookie/user, so it can't be part of the cached page render) and
 * renders nothing until it has products - a secondary strip shouldn't flash a
 * skeleton. Reuses the shared product carousel with its own heading.
 */
export function RecentlyViewedCarousel({
  excludeProductId,
}: {
  excludeProductId?: string;
}) {
  const t = useTranslations("interactions");
  const [products, setProducts] = useState<RelatedProduct[] | null>(null);

  useEffect(() => {
    let active = true;
    axios
      .get<{ products: RelatedProduct[] }>("/api/interactions/recently-viewed", {
        params: excludeProductId ? { exclude: excludeProductId } : {},
      })
      .then((res) => {
        if (active) setProducts(res.data.products ?? []);
      })
      .catch(() => {
        if (active) setProducts([]);
      });
    return () => {
      active = false;
    };
  }, [excludeProductId]);

  if (!products || products.length === 0) return null;

  return (
    <RelatedProductsCarousel
      products={products}
      eyebrow={t("recentlyViewedEyebrow")}
      title={t("recentlyViewed")}
      showViewAll={false}
      autoplay={false}
    />
  );
}
