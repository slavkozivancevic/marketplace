"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useCartStore } from "../store/cartStore";
import { SerializedPublicProduct } from "@/types/types";

interface AddToCartProps {
  product: SerializedPublicProduct;
  onActiveVariantChange?: (variantId: string | null) => void;
}

type SelectedValues = Record<string, string>;

export function AddToCart({ product, onActiveVariantChange }: AddToCartProps) {
  const t = useTranslations("cart");
  const { addItem, openCart, items } = useCartStore();
  const hasOptions = product.options.length > 0;

  const optionVariants = product.variants.filter(
    (v) => v.optionValues.length > 0,
  );
  const manualVariants = product.variants.filter(
    (v) => v.optionValues.length === 0,
  );

  const [selectedValues, setSelectedValues] = useState<SelectedValues>(() => {
    if (!hasOptions) return {};
    const firstInStock = optionVariants.find((v) => v.stock > 0);
    if (!firstInStock) return {};
    return Object.fromEntries(
      firstInStock.optionValues.map((ov) => [ov.optionId, ov.value]),
    );
  });

  const [selectedManualId, setSelectedManualId] = useState<string | null>(null);

  const optionSelectedVariant = hasOptions
    ? optionVariants.find((variant) =>
        product.options.every((option) =>
          variant.optionValues.some(
            (ov) =>
              ov.optionId === option.id &&
              ov.value === selectedValues[option.id],
          ),
        ),
      )
    : undefined;

  const manualSelectedVariant = manualVariants.find(
    (v) => v.id === selectedManualId,
  );

  const activeVariant = manualSelectedVariant ?? optionSelectedVariant;

  useEffect(() => {
    onActiveVariantChange?.(activeVariant?.id ?? null);
  }, [activeVariant?.id, onActiveVariantChange]);

  const allOptionsSelected =
    !hasOptions ||
    Boolean(selectedManualId) ||
    product.options.every((opt) => Boolean(selectedValues[opt.id]));

  const price = activeVariant ? activeVariant.price : product.price;
  const compareAtPrice = activeVariant
    ? activeVariant.compareAtPrice
    : product.compareAtPrice;
  const isOnSale = compareAtPrice != null && compareAtPrice > price;
  const salePct = isOnSale
    ? Math.round(((compareAtPrice! - price) / compareAtPrice!) * 100)
    : 0;

  const cartQuantity =
    items.find(
      (i) =>
        i.productId === product.id &&
        i.variantId === (activeVariant?.id ?? null),
    )?.quantity ?? 0;

  const isOutOfStock =
    product.variants.length > 0
      ? !allOptionsSelected ||
        !activeVariant ||
        activeVariant.stock === 0 ||
        cartQuantity >= activeVariant.stock
      : product.stock !== null &&
        (product.stock === 0 || cartQuantity >= product.stock);

  function isCompatible(optionId: string, value: string): boolean {
    const otherEntries = Object.entries(selectedValues).filter(
      ([id]) => id !== optionId,
    );
    return product.variants.some(
      (v) =>
        v.optionValues.some(
          (ov) => ov.optionId === optionId && ov.value === value,
        ) &&
        otherEntries.every(([selOptId, selVal]) =>
          v.optionValues.some(
            (ov) => ov.optionId === selOptId && ov.value === selVal,
          ),
        ),
    );
  }

  function isInStock(optionId: string, value: string): boolean {
    const otherEntries = Object.entries(selectedValues).filter(
      ([id]) => id !== optionId,
    );
    return product.variants.some(
      (v) =>
        v.stock > 0 &&
        v.optionValues.some(
          (ov) => ov.optionId === optionId && ov.value === value,
        ) &&
        otherEntries.every(([selOptId, selVal]) =>
          v.optionValues.some(
            (ov) => ov.optionId === selOptId && ov.value === selVal,
          ),
        ),
    );
  }

  function handleSelect(optionId: string, value: string) {
    setSelectedManualId(null);

    setSelectedValues((prev) => {
      if (prev[optionId] === value) {
        const next = { ...prev };
        delete next[optionId];
        return next;
      }

      const next = { ...prev, [optionId]: value };

      for (const option of product.options) {
        if (option.id === optionId) continue;
        if (!next[option.id]) continue;

        const currentStillValid = product.variants.some((v) =>
          Object.entries(next).every(([selOptId, selVal]) =>
            v.optionValues.some(
              (ov) => ov.optionId === selOptId && ov.value === selVal,
            ),
          ),
        );

        if (!currentStillValid) {
          const uniqueVals = [...new Set(option.values.map((v) => v.value))];
          const fallback =
            uniqueVals.find((val) =>
              product.variants.some(
                (v) =>
                  v.stock > 0 &&
                  v.optionValues.some(
                    (ov) => ov.optionId === optionId && ov.value === value,
                  ) &&
                  v.optionValues.some(
                    (ov) => ov.optionId === option.id && ov.value === val,
                  ),
              ),
            ) ??
            uniqueVals.find((val) =>
              product.variants.some(
                (v) =>
                  v.optionValues.some(
                    (ov) => ov.optionId === optionId && ov.value === value,
                  ) &&
                  v.optionValues.some(
                    (ov) => ov.optionId === option.id && ov.value === val,
                  ),
              ),
            );

          if (fallback) {
            next[option.id] = fallback;
          } else {
            delete next[option.id];
          }
        }
      }

      return next;
    });
  }

  function handleSelectManual(variantId: string) {
    setSelectedValues({});
    setSelectedManualId((prev) => (prev === variantId ? null : variantId));
  }

  function handleAdd() {
    const variantFirstImageId = activeVariant?.images[0]?.imageId;
    const variantFirstImageUrl = variantFirstImageId
      ? (product.images.find((img) => img.id === variantFirstImageId)?.url ??
        null)
      : null;
    const firstImage = variantFirstImageUrl ?? product.images[0]?.url ?? null;
    const optionLabel = activeVariant?.optionValues
      .map((ov) => ov.value)
      .join(" / ");
    const variantLabel = optionLabel || activeVariant?.sku || null;

    const maxStock = activeVariant
      ? activeVariant.stock
      : (product.stock ?? null);

    addItem({
      productId: product.id,
      productTitle: product.title,
      productImage: firstImage,
      variantId: activeVariant?.id ?? null,
      variantSku: activeVariant?.sku ?? null,
      variantLabel,
      price,
      maxStock,
      requiresShipping: product.requiresShipping,
    });

    openCart();
  }

  return (
    <div className="space-y-5">
      {product.options.map((option) => {
        const uniqueValues = [...new Set(option.values.map((v) => v.value))];
        const selected = selectedValues[option.id];

        return (
          <div key={option.id}>
            <p className="text-sm font-medium mb-2.5">
              {option.name}
              {selected && (
                <span className="font-normal text-muted-foreground ml-1.5">
                  — {selected}
                </span>
              )}
            </p>

            <div className="flex flex-wrap gap-2">
              {uniqueValues.map((value) => {
                const compatible = isCompatible(option.id, value);
                const inStock = isInStock(option.id, value);
                const isSelected = !selectedManualId && selected === value;

                return (
                  <button
                    key={value}
                    onClick={() => compatible && handleSelect(option.id, value)}
                    disabled={!compatible}
                    className={cn(
                      "relative px-3 py-1.5 text-sm rounded-md border transition-all select-none",
                      isSelected &&
                        "border-primary bg-primary text-primary-foreground shadow-sm",
                      !isSelected &&
                        compatible &&
                        inStock &&
                        "border-input bg-background hover:border-primary cursor-pointer",
                      !isSelected &&
                        compatible &&
                        !inStock &&
                        "border-input bg-background text-muted-foreground cursor-pointer",
                      !compatible &&
                        "border-input bg-muted text-muted-foreground opacity-40 cursor-not-allowed",
                    )}
                  >
                    {compatible && !inStock && !isSelected && (
                      <span
                        aria-hidden
                        className="absolute inset-0 flex items-center justify-center pointer-events-none"
                      >
                        <span className="absolute w-[calc(100%+4px)] h-px bg-muted-foreground/50 -rotate-12" />
                      </span>
                    )}
                    {value}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Manual variants section */}
      {manualVariants.length > 0 && (
        <div>
          {hasOptions && (
            <p className="text-sm font-medium mb-2.5">{t("otherVariants")}</p>
          )}
          <div className="flex flex-wrap gap-2">
            {manualVariants.map((variant) => {
              const isSelected = selectedManualId === variant.id;
              const outOfStock = variant.stock === 0;

              return (
                <button
                  key={variant.id}
                  onClick={() => handleSelectManual(variant.id)}
                  className={cn(
                    "relative px-3 py-1.5 text-sm rounded-md border transition-all select-none",
                    isSelected &&
                      "border-primary bg-primary text-primary-foreground shadow-sm",
                    !isSelected &&
                      !outOfStock &&
                      "border-input bg-background hover:border-primary cursor-pointer",
                    !isSelected &&
                      outOfStock &&
                      "border-input bg-background text-muted-foreground cursor-pointer",
                  )}
                >
                  {outOfStock && !isSelected && (
                    <span
                      aria-hidden
                      className="absolute inset-0 flex items-center justify-center pointer-events-none"
                    >
                      <span className="absolute w-[calc(100%+4px)] h-px bg-muted-foreground/50 -rotate-12" />
                    </span>
                  )}
                  {variant.sku ?? `Variant ${variant.id.slice(-4)}`}
                  {variant.price !== product.price && (
                    <span className="ml-1.5 text-xs opacity-75">
                      ${variant.price.toFixed(2)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Stock indicator for selected variant */}
      {activeVariant && allOptionsSelected && (
        <p
          className={cn(
            "text-sm",
            activeVariant.stock > 0
              ? activeVariant.stock <= 5
                ? "text-amber-600 dark:text-amber-400"
                : "text-muted-foreground"
              : "text-destructive",
          )}
        >
          {activeVariant.stock > 5
            ? t("inStock", { count: activeVariant.stock })
            : activeVariant.stock > 0
              ? t("onlyLeft", { count: activeVariant.stock })
              : t("outOfStock")}
        </p>
      )}

      {/* Stock indicator for variant-less products */}
      {product.variants.length === 0 && product.stock !== null && (
        <p
          className={cn(
            "text-sm",
            product.stock > 0
              ? product.stock <= 5
                ? "text-amber-600 dark:text-amber-400"
                : "text-muted-foreground"
              : "text-destructive",
          )}
        >
          {product.stock > 5
            ? t("inStock", { count: product.stock })
            : product.stock > 0
              ? t("onlyLeft", { count: product.stock })
              : t("outOfStock")}
        </p>
      )}

      <Button
        className="w-full relative"
        size="lg"
        onClick={handleAdd}
        disabled={isOutOfStock}
      >
        <ShoppingCart className="mr-2 h-4 w-4" />
        {!allOptionsSelected
          ? t("selectAllOptions")
          : isOutOfStock
            ? t("outOfStockBtn")
            : t("addToCart", { price: price.toFixed(2) })}
        {isOnSale && !isOutOfStock && allOptionsSelected && (
          <span className="ml-2 bg-white/20 text-white text-xs font-bold px-1.5 py-0.5 rounded-4xl">
            -{salePct}%
          </span>
        )}
      </Button>
    </div>
  );
}
