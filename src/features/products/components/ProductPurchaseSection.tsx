"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AddToCart } from "@/features/cart/components/AddToCart";
import { cn } from "@/lib/utils";
import { SerializedPublicProduct } from "@/types/types";

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
  const activeVariant = activeVariantId
    ? product.variants.find((v) => v.id === activeVariantId)
    : null;

  const displayPrice = activeVariant ? activeVariant.price : product.price;
  const displayCompareAt = activeVariant
    ? activeVariant.compareAtPrice
    : product.compareAtPrice;
  const isOnSale = displayCompareAt != null && displayCompareAt > displayPrice;

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-baseline gap-3 flex-wrap">
            {isOnSale ? (
              <>
                <span className="text-3xl font-bold text-red-500">
                  ${displayPrice.toFixed(2)}
                </span>
                <span className="text-xl text-muted-foreground line-through">
                  ${displayCompareAt!.toFixed(2)}
                </span>
                <Badge className="bg-red-500 text-white hover:bg-red-600">
                  -{discountPct(displayPrice, displayCompareAt!)}%
                </Badge>
              </>
            ) : (
              <span className="text-3xl font-bold">${displayPrice.toFixed(2)}</span>
            )}
          </div>
          <p className="text-muted-foreground">{product.description}</p>
          <AddToCart
            product={product}
            onActiveVariantChange={onActiveVariantChange}
          />
        </CardContent>
      </Card>

      {product.options.length > 0 && (
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
      )}

      {product.variants.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Variants</CardTitle>
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
                        {ov.value}
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
                          ${variant.price.toFixed(2)}
                        </span>
                        <span className="text-xs line-through text-muted-foreground">
                          ${variant.compareAtPrice!.toFixed(2)}
                        </span>
                        <Badge className="bg-red-500 text-white hover:bg-red-600 text-xs py-0">
                          -{discountPct(variant.price, variant.compareAtPrice!)}%
                        </Badge>
                      </span>
                    ) : (
                      <span>${variant.price.toFixed(2)}</span>
                    )}
                    <span>
                      {variant.stock > 0
                        ? `${variant.stock} in stock`
                        : "Out of stock"}
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
          <AlertTitle>No variants available</AlertTitle>
          <AlertDescription>
            This product has no variants configured.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
