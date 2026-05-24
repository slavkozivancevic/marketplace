"use client";

import { useTranslations, useLocale } from "next-intl";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AddToCart } from "@/features/cart/components/AddToCart";
import { WishlistButton } from "@/features/wishlist/components/WishlistButton";
import { MessageSellerButton } from "@/features/chat/components/MessageSellerButton";
import { cn } from "@/lib/utils";
import { SerializedPublicProduct } from "@/types/types";
import { useCurrencyStore } from "@/store/currency";
import { formatPrice, convertCents } from "@/lib/currency";
import { getOptionValue, type OptionTranslations } from "@/features/products/utils/optionTranslations";
import { getProductDescription, type ProductTranslations } from "@/features/products/utils/translations";

interface ProductPurchaseSectionProps {
  product: SerializedPublicProduct;
  activeVariantId: string | null;
  onActiveVariantChange: (variantId: string | null) => void;
}

function discountPct(price: number, compareAtPrice: number): number {
  return Math.round(((compareAtPrice - price) / compareAtPrice) * 100);
}

export function ProductPurchaseSection({
  product,
  activeVariantId,
  onActiveVariantChange,
}: ProductPurchaseSectionProps) {
  const t = useTranslations("products");
  const tCart = useTranslations("cart");
  const locale = useLocale();
  const { currency, currentRate } = useCurrencyStore();
  const activeVariant = activeVariantId
    ? product.variants.find((v) => v.id === activeVariantId)
    : null;

  const optionById = new Map(product.options.map((o) => [o.id, o]));
  const translateOptionValue = (optionId: string, value: string) => {
    const opt = optionById.get(optionId);
    if (!opt) return value;
    return getOptionValue({ translations: opt.translations as OptionTranslations | null }, value, locale);
  };

  const displayPrice = activeVariant ? activeVariant.price : product.price;
  const displayCompareAt = activeVariant
    ? activeVariant.compareAtPrice
    : product.compareAtPrice;
  const isOnSale = displayCompareAt != null && displayCompareAt > displayPrice;

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-baseline gap-3 flex-wrap">
              {isOnSale ? (
                <>
                  <span className="text-3xl font-bold text-red-500">
                    {formatPrice(convertCents(displayPrice, currency, currentRate()), currency)}
                  </span>
                  <span className="text-xl text-muted-foreground line-through">
                    {formatPrice(convertCents(displayCompareAt!, currency, currentRate()), currency)}
                  </span>
                  <Badge className="bg-red-500 text-white hover:bg-red-600">
                    -{discountPct(displayPrice, displayCompareAt!)}%
                  </Badge>
                </>
              ) : (
                <span className="text-3xl font-bold">{formatPrice(convertCents(displayPrice, currency, currentRate()), currency)}</span>
              )}
            </div>
            <WishlistButton productId={product.id} size={20} className="shrink-0" />
          </div>
          {product.brand && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground font-medium">{t("brandLabel")}</span>
              {product.brand.logoUrl && (
                <div className="relative h-5 w-5 shrink-0 overflow-hidden rounded-sm border bg-muted">
                  <Image
                    src={product.brand.logoUrl}
                    alt={product.brand.name}
                    fill
                    sizes="20px"
                    className="object-contain"
                  />
                </div>
              )}
              <span className="font-medium">{product.brand.name}</span>
            </div>
          )}
          <p className="text-muted-foreground">
            {getProductDescription(
              {
                description: product.description,
                translations: product.translations as ProductTranslations | null,
              },
              locale,
            )}
          </p>
          <AddToCart
            product={product}
            onActiveVariantChange={onActiveVariantChange}
          />
          <MessageSellerButton productId={product.id} className="w-full" />
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

      {product.variants.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t("variantsTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {product.variants.map((variant) => {
              const isSelected = variant.id === activeVariantId;
              const variantOnSale =
                variant.compareAtPrice != null &&
                variant.compareAtPrice > variant.price;

              return (
                <div
                  key={variant.id}
                  className={cn(
                    "flex items-center justify-between border rounded p-2 text-sm transition-all",
                    isSelected
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "border-input",
                  )}
                >
                  <div className="flex flex-wrap gap-1">
                    {variant.optionValues.map((ov) => (
                      <Badge
                        key={ov.id}
                        variant={isSelected ? "default" : "secondary"}
                      >
                        {translateOptionValue(ov.optionId, ov.value)}
                      </Badge>
                    ))}
                  </div>
                  <div
                    className={cn(
                      "flex items-center gap-4",
                      isSelected
                        ? "text-foreground font-medium"
                        : "text-muted-foreground",
                    )}
                  >
                    {variantOnSale ? (
                      <span className="flex items-baseline gap-1.5">
                        <span className="text-red-500 font-semibold">
                          {formatPrice(convertCents(variant.price, currency, currentRate()), currency)}
                        </span>
                        <span className="text-xs line-through text-muted-foreground">
                          {formatPrice(convertCents(variant.compareAtPrice!, currency, currentRate()), currency)}
                        </span>
                        <Badge className="bg-red-500 text-white hover:bg-red-600 text-xs py-0">
                          -{discountPct(variant.price, variant.compareAtPrice!)}%
                        </Badge>
                      </span>
                    ) : (
                      <span>{formatPrice(convertCents(variant.price, currency, currentRate()), currency)}</span>
                    )}
                    <span>
                      {variant.stock > 0
                        ? tCart("inStock", { count: variant.stock })
                        : tCart("outOfStock")}
                    </span>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

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
