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

  const activeVariant = activeVariantId
    ? product.variants.find((v) => v.id === activeVariantId)
    : undefined;
  const activeImageId = activeVariant?.imageId ?? null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div className="space-y-4">
        <ProductImageCarousel
          images={product.images}
          title={product.title}
          activeImageId={activeImageId}
        />
      </div>

      <ProductPurchaseSection
        product={product}
        activeVariantId={activeVariantId}
        onActiveVariantChange={setActiveVariantId}
      />
    </div>
  );
}
