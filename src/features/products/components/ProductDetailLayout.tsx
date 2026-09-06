"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ProductImageCarousel } from "@/components/product/ProductImageCarousel";
import { ProductPurchaseSection } from "./ProductPurchaseSection";
import {
  ProductSpecifications,
  buildSpecRows,
} from "./ProductSpecifications";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SerializedPublicProduct } from "@/types/types";
import {
  getProductTitle,
  getProductDescription,
} from "@/features/products/utils/translations";

interface ProductDetailLayoutProps {
  product: SerializedPublicProduct;
  isOwnProduct: boolean;
}

export function ProductDetailLayout({ product, isOwnProduct }: ProductDetailLayoutProps) {
  const locale = useLocale();
  const t = useTranslations("products");
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

  const description = getProductDescription(product, locale);
  const specRows = buildSpecRows(product, locale, t);

  return (
    <div className="space-y-10">
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
          isOwnProduct={isOwnProduct}
        />
      </div>

      {/* Description and specifications, below the buy box. The specifications
          tab is dropped entirely when the product has no facts to show, rather
          than offering a tab that opens onto nothing. */}
      <Tabs defaultValue="description">
        <TabsList>
          <TabsTrigger value="description">{t("tabDescription")}</TabsTrigger>
          {specRows.length > 0 && (
            <TabsTrigger value="specifications">{t("tabSpecifications")}</TabsTrigger>
          )}
        </TabsList>

        {/* forceMount: Radix unmounts the inactive panel, which would drop the
            description out of the server-rendered HTML whenever a crawler (or
            a shared link) landed on another tab. Both panels stay in the DOM;
            `hidden` keeps only one visible. */}
        <TabsContent
          value="description"
          forceMount
          className="pt-4 data-[state=inactive]:hidden"
        >
          <p className="max-w-3xl whitespace-pre-line text-muted-foreground">
            {description}
          </p>
        </TabsContent>
        {specRows.length > 0 && (
          <TabsContent
            value="specifications"
            forceMount
            className="pt-4 data-[state=inactive]:hidden"
          >
            <ProductSpecifications rows={specRows} className="max-w-3xl" />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
