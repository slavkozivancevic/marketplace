"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AddToCart } from "@/features/cart/components/AddToCart";
import { cn } from "@/lib/utils";
import { SerializedPublicProduct } from "@/types/types";

interface ProductPurchaseSectionProps {
  product: SerializedPublicProduct;
}

export function ProductPurchaseSection({
  product,
}: ProductPurchaseSectionProps) {
  const [activeVariantId, setActiveVariantId] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-6 space-y-4">
          <p className="text-3xl font-bold">${product.price.toFixed(2)}</p>
          <p className="text-muted-foreground">{product.description}</p>
          <AddToCart
            product={product}
            onActiveVariantChange={setActiveVariantId}
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
                    <span>${variant.price.toFixed(2)}</span>
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
