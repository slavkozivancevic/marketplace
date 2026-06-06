"use client";

import { useState } from "react";
import { useLocale } from "next-intl";
import { ProductImageCarousel } from "@/components/product/ProductImageCarousel";
import { ProductPurchaseSection } from "./ProductPurchaseSection";
import { SerializedPublicProduct } from "@/types/types";
import { getProductTitle } from "@/features/products/utils/translations";

interface ProductDetailLayoutProps {
  product: SerializedPublicProduct;
}

export function ProductDetailLayout({ product }: ProductDetailLayoutProps) {
  const locale = useLocale();
  const localTitle = getProductTitle(product, locale);
  // Match AddToCart's initial-variant logic so the variant list is already
  // highlighted in the SSR HTML - without this, the highlight lags until
  // hydration + AddToCart's useEffect callback fires.
  const [activeVariantId, setActiveVariantId] = useState<string | null>(() => {
    const optionVariants = product.variants.filter(
      (v) => v.optionValues.length > 0,
    );
    if (optionVariants.length === 0) return null;
    return optionVariants.find((v) => v.stock > 0)?.id ?? null;
  });
  const [jumpTicket, setJumpTicket] = useState<{
    ticket: number;
    mediaId: string | null;
  }>({ ticket: 0, mediaId: null });

  const handleActiveVariantChange = (variantId: string | null) => {
    setActiveVariantId(variantId);

    const variant = variantId
      ? product.variants.find((v) => v.id === variantId)
      : undefined;
    const firstMediaId = variant?.media[0]?.mediaId ?? null;
    if (!firstMediaId) return;

    setJumpTicket((prev) => ({
      ticket: prev.ticket + 1,
      mediaId: firstMediaId,
    }));
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div className="space-y-4">
        <ProductImageCarousel
          media={product.media}
          title={localTitle}
          jumpToMediaId={jumpTicket.mediaId}
          jumpTicket={jumpTicket.ticket}
        />
      </div>

      <ProductPurchaseSection
        product={product}
        activeVariantId={activeVariantId}
        onActiveVariantChange={handleActiveVariantChange}
      />
    </div>
  );
}
