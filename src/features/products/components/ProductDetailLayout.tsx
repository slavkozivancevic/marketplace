"use client";

import { useState } from "react";
import { ProductImageCarousel } from "@/components/product/ProductImageCarousel";
import { ProductPurchaseSection } from "./ProductPurchaseSection";
import { SerializedPublicProduct } from "@/types/types";

interface ProductDetailLayoutProps {
  product: SerializedPublicProduct;
}

export function ProductDetailLayout({ product }: ProductDetailLayoutProps) {
  const [activeVariantId, setActiveVariantId] = useState<string | null>(null);
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
          title={product.title}
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
