"use client";

import { useTranslations, useLocale } from "next-intl";
import { Award, ShieldCheck } from "lucide-react";
import { BrandLogo } from "@/features/brands/components/BrandLogo";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AddToCart } from "@/features/cart/components/AddToCart";
import { WishlistButton } from "@/features/wishlist/components/WishlistButton";
import { MessageSellerButton } from "@/features/chat/components/MessageSellerButton";
import { cn } from "@/lib/utils";
import { SerializedPublicProduct } from "@/types/types";
import { useMoney } from "@/lib/useMoney";
import { formatPrice } from "@/lib/currency";
import { getBrandName } from "@/features/brands/utils/translations";
import { getTagName } from "@/features/tags/utils/translations";

interface ProductPurchaseSectionProps {
  product: SerializedPublicProduct;
  activeVariantId: string | null;
  onActiveVariantChange: (variantId: string | null) => void;
  isOwnProduct: boolean;
}

function discountPct(price: number, compareAtPrice: number): number {
  return Math.round(((compareAtPrice - price) / compareAtPrice) * 100);
}

export function ProductPurchaseSection({
  product,
  activeVariantId,
  onActiveVariantChange,
  isOwnProduct,
}: ProductPurchaseSectionProps) {
  const t = useTranslations("products");
  const locale = useLocale();
  // Every amount below is the one stored for the active currency, resolved
  // once here. Nothing on this path touches an exchange rate.
  const { amount: moneyAmount, currency } = useMoney();
  const activeVariant = activeVariantId
    ? product.variants.find((v) => v.id === activeVariantId)
    : null;

  const localBrandName = product.brand ? getBrandName(product.brand, locale) : "";

  const priceSource = activeVariant ?? product;
  const displayPrice = moneyAmount(priceSource.priceMoney, priceSource.price);
  const compareAtSource =
    activeVariant && activeVariant.compareAtPrice == null ? product : priceSource;
  const displayCompareAt =
    compareAtSource.compareAtPrice != null
      ? moneyAmount(compareAtSource.compareAtPriceMoney, compareAtSource.compareAtPrice)
      : null;
  const isOnSale = displayCompareAt != null && displayCompareAt > displayPrice;

  const priceRow = (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-baseline gap-3 flex-wrap">
        {isOnSale ? (
          <>
            <span className="text-3xl font-bold text-red-500">
              {formatPrice(displayPrice, currency, locale)}
            </span>
            <span className="text-xl text-muted-foreground line-through">
              {formatPrice(displayCompareAt!, currency, locale)}
            </span>
            <Badge className="bg-red-500 text-white">
              -{discountPct(displayPrice, displayCompareAt!)}%
            </Badge>
          </>
        ) : (
          <span className="text-3xl font-bold">{formatPrice(displayPrice, currency, locale)}</span>
        )}
      </div>
      <WishlistButton productId={product.id} size={20} className="shrink-0" />
    </div>
  );

  // The per-SKU table used to be the only place a buyer could see that other
  // variants cost less. One line says the same thing without listing every SKU.
  const variantPrices = product.variants.map((v) => moneyAmount(v.priceMoney, v.price));
  const minVariantPrice = variantPrices.length ? Math.min(...variantPrices) : null;
  const maxVariantPrice = variantPrices.length ? Math.max(...variantPrices) : null;
  const showPriceRange =
    minVariantPrice != null && maxVariantPrice != null && maxVariantPrice > minVariantPrice;

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className={cn("space-y-4", product.isBestseller ? "pt-4" : "pt-6")}>
          {product.isBestseller ? (
            <div className="space-y-2">
              <Badge className="w-fit gap-1 bg-amber-500 text-white">
                <Award className="h-3.5 w-3.5" />
                {t("bestsellerBadge")}
              </Badge>
              {priceRow}
            </div>
          ) : (
            priceRow
          )}
          {showPriceRange && (
            <p className="text-sm text-muted-foreground">
              {t("variantPriceRange", {
                min: formatPrice(minVariantPrice!, currency, locale),
                max: formatPrice(maxVariantPrice!, currency, locale),
              })}
            </p>
          )}
          {product.brand && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground font-medium">{t("brandLabel")}</span>
              <BrandLogo
                src={product.brand.logoUrl}
                srcDark={product.brand.logoUrlDark}
                backdrop={product.brand.logoBackdrop}
                backdropDark={product.brand.logoBackdropDark}
                name={localBrandName}
                size={20}
              />
              <span className="font-medium">{localBrandName}</span>
            </div>
          )}
          {product.tags.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap text-sm">
              <span className="text-muted-foreground font-medium">{t("tagsLabel")}</span>
              {product.tags.map((pt) => (
                <Badge key={pt.tagId} variant="secondary">
                  {getTagName(pt.tag, locale)}
                </Badge>
              ))}
            </div>
          )}
          {/* One trust line, not a spec strip: warranty next to the buy button
              is a conversion signal, everything else lives in the
              specifications tab below. Skipped when warranty is 0 - "no
              warranty" is a fact for the table, not a selling point here. */}
          {product.warrantyMonths != null && product.warrantyMonths > 0 && (
            <p className="flex items-center gap-1.5 text-sm">
              <ShieldCheck className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">
                {t("warrantyValue", { count: product.warrantyMonths })}
              </span>
            </p>
          )}
          <AddToCart
            product={product}
            onActiveVariantChange={onActiveVariantChange}
          />
          <MessageSellerButton
            productId={product.id}
            className="w-full"
            isOwnProduct={isOwnProduct}
          />
        </CardContent>
      </Card>

      {/* Options card removed - redundant with AddToCart variant selector */}
      {/* {product.options.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Options</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {product.options.map((option) => (
              <div key={option.id}>
                <p className="text-sm font-medium mb-1">{option.name}</p>
                <div className="flex flex-wrap gap-1">
                  {Array.from(
                    new Set(option.values.map((v) => v.value)),
                  ).map((value) => (
                    <Badge key={value} variant="outline">
                      {value}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )} */}


      {product.variants.length === 0 && (
        <Alert>
          <AlertTitle>{t("noVariants")}</AlertTitle>
          <AlertDescription>
            {t("noVariantsDesc")}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
