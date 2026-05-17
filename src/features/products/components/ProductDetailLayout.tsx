"use client";

import { useState } from "react";
import { useLocale } from "next-intl";
import { ProductImageCarousel } from "@/components/product/ProductImageCarousel";
import { ProductPurchaseSection } from "./ProductPurchaseSection";
import { SerializedPublicProduct } from "@/types/types";
import { getProductTitle, type ProductTranslations } from "@/features/products/utils/translations";

interface ProductDetailLayoutProps {
  product: SerializedPublicProduct;
}

export function ProductDetailLayout({ product }: ProductDetailLayoutProps) {
  const locale = useLocale();
  const localTitle = getProductTitle(
    { title: product.title, translations: product.translations as ProductTranslations | null },
    locale,
  );
  // Match AddToCart's initial-variant logic so the variant list is already
  // highlighted in the SSR HTML — without this, the highlight lags until
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
    imageId: string | null;
  }>({ ticket: 0, imageId: null });

  const handleActiveVariantChange = (variantId: string | null) => {
    setActiveVariantId(variantId);

    const variant = variantId
      ? product.variants.find((v) => v.id === variantId)
      : undefined;
    const firstImageId = variant?.images[0]?.imageId ?? null;
    if (!firstImageId) return;

    setJumpTicket((prev) => ({
      ticket: prev.ticket + 1,
      imageId: firstImageId,
    }));
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div className="space-y-4">
        <ProductImageCarousel
          images={product.images}
          title={localTitle}
          jumpToImageId={jumpTicket.imageId}
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
