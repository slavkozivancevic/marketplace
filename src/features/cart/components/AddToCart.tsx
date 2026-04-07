"use client";

import { useState } from "react";
import { ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCartStore } from "../store/cartStore";
import { SerializedPublicProduct } from "@/types/types";

interface AddToCartProps {
  product: SerializedPublicProduct;
}

export function AddToCart({ product }: AddToCartProps) {
  const { addItem, openCart } = useCartStore();
  const [selectedVariantId, setSelectedVariantId] = useState<string>(
    product.variants[0]?.id ?? "",
  );

  const hasVariants = product.variants.length > 0;
  const selectedVariant = product.variants.find(
    (v) => v.id === selectedVariantId,
  );

  const isOutOfStock = hasVariants
    ? !selectedVariant || selectedVariant.stock === 0
    : false;

  const price = selectedVariant?.price ?? product.price;

  const buildVariantLabel = (variantId: string) => {
    const variant = product.variants.find((v) => v.id === variantId);
    if (!variant?.optionValues.length) return null;
    return variant.optionValues.map((ov) => ov.value).join(" / ");
  };

  const handleAdd = () => {
    const firstImage = product.images[0]?.url ?? null;

    addItem({
      productId: product.id,
      productTitle: product.title,
      productImage: firstImage,
      variantId: selectedVariant?.id ?? null,
      variantSku: selectedVariant?.sku ?? null,
      variantLabel: selectedVariant ? buildVariantLabel(selectedVariant.id) : null,
      price,
    });

    openCart();
  };

  return (
    <div className="space-y-3">
      {hasVariants && (
        <Select value={selectedVariantId} onValueChange={setSelectedVariantId}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select variant" />
          </SelectTrigger>
          <SelectContent>
            {product.variants.map((variant) => {
              const label = buildVariantLabel(variant.id) ?? variant.sku;
              return (
                <SelectItem
                  key={variant.id}
                  value={variant.id}
                  disabled={variant.stock === 0}
                >
                  {label}
                  {variant.stock === 0 ? " (Out of stock)" : ` — $${variant.price.toFixed(2)}`}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      )}

      <Button
        className="w-full"
        size="lg"
        onClick={handleAdd}
        disabled={isOutOfStock}
      >
        <ShoppingCart className="mr-2 h-4 w-4" />
        {isOutOfStock ? "Out of Stock" : `Add to Cart — $${price.toFixed(2)}`}
      </Button>
    </div>
  );
}
