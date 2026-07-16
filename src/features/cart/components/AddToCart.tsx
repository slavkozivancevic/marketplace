"use client";

import { useEffect, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useCartStore } from "../store/cartStore";
import { useCurrencyStore } from "@/store/currency";
import { formatPrice, convertCents } from "@/lib/currency";
import { SerializedPublicProduct } from "@/types/types";
import {
  getOptionName,
  getOptionValue,
} from "@/features/products/utils/optionTranslations";
import { buildCartVariantOptions, buildLocalizedText } from "@/features/cart/utils/variantOptions";
import { getProductTitle } from "@/features/products/utils/translations";
import { recordInteractionClient } from "@/features/interactions/recordClient";

interface AddToCartProps {
  product: SerializedPublicProduct;
  onActiveVariantChange?: (variantId: string | null) => void;
  /** Use <Select> dropdowns instead of pill buttons - better for compact layouts */
  selectMode?: boolean;
  /** Omit the Add to Cart button - parent renders it instead */
  hideButton?: boolean;
}

type SelectedValues = Record<string, string>;

export function AddToCart({ product, onActiveVariantChange, selectMode = false, hideButton = false }: AddToCartProps) {
  const t = useTranslations("cart");
  const locale = useLocale();
  const { addItem, openCart, items } = useCartStore();
  const { currency, currentRate } = useCurrencyStore();
  const hasOptions = product.options.length > 0;

  const localizedOption = (option: typeof product.options[number]) => ({
    name: getOptionName(option, locale),
    translate: (value: string) => getOptionValue(option, value, locale),
  });

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
  // A variant without its own compareAtPrice still benefits from a
  // product-level sale (the common case: one sale across all variants).
  const compareAtPrice = activeVariant
    ? (activeVariant.compareAtPrice ?? product.compareAtPrice)
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
    // Cart thumbnails are still images - pick the first IMAGE-type media on
    // the variant, then fall back to the product's first image-type media.
    const variantImageRef = activeVariant?.media.find(
      (vm) => vm.media.mediaType === "IMAGE",
    );
    const variantFirstImageUrl = variantImageRef
      ? (variantImageRef.media.thumbUrl ?? variantImageRef.media.url)
      : null;
    const firstProductImage = product.media.find(
      (m) => m.mediaType === "IMAGE",
    );
    const firstImage =
      variantFirstImageUrl ??
      (firstProductImage
        ? (firstProductImage.thumbUrl ?? firstProductImage.url)
        : null);
    // Snapshot the selected options translated for every locale so the cart
    // can render the label in whatever language is active at view time.
    const variantOptions =
      activeVariant && activeVariant.optionValues.length > 0
        ? buildCartVariantOptions(activeVariant.optionValues, product.options)
        : null;
    // SKU is the non-translatable fallback (manual variants / no options).
    const variantLabel = activeVariant?.sku ?? null;

    const maxStock = activeVariant
      ? activeVariant.stock
      : (product.stock ?? null);

    addItem({
      productId: product.id,
      productTitleI18n: buildLocalizedText((loc) => getProductTitle(product, loc)),
      productTitle: getProductTitle(product, locale),
      productImage: firstImage,
      variantId: activeVariant?.id ?? null,
      variantSku: activeVariant?.sku ?? null,
      variantOptions,
      variantLabel,
      price,
      maxStock,
      requiresShipping: product.requiresShipping,
    });

    // Engagement signal (best-effort, fire-and-forget) for the funnel/analytics.
    recordInteractionClient("ADD_TO_CART", product.id);

    openCart();
  }

  return (
    <div className="space-y-4">
      {/* ── Option selectors ── */}
      {selectMode ? (
        /* Dropdown mode */
        <>
          {product.options.map((option) => {
            const uniqueValues = [...new Set(option.values.map((v) => v.value))];
            const selected = selectedValues[option.id];
            const loc = localizedOption(option);

            return (
              <div key={option.id} className="space-y-1.5">
                <p className="text-sm font-medium">{loc.name}</p>
                <Select
                  value={selected ?? ""}
                  onValueChange={(val) => {
                    setSelectedManualId(null);
                    handleSelect(option.id, val);
                  }}
                >
                  <SelectTrigger className="w-full">
                    {/* Explicit label so it shows pre-hydration (Radix
                        SelectContent is portaled and not available for
                        value→item lookup yet). */}
                    <SelectValue placeholder={`- ${t("selectOption")}`}>
                      {selected ? loc.translate(selected) : null}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent position="popper">
                    {uniqueValues.map((value) => {
                      const compatible = isCompatible(option.id, value);
                      const inStock = isInStock(option.id, value);
                      return (
                        <SelectItem
                          key={value}
                          value={value}
                          disabled={!compatible}
                          className={cn(!inStock && compatible && "text-muted-foreground")}
                        >
                          {loc.translate(value)}
                          {!inStock && compatible && (
                            <span className="ml-1 text-xs">({t("outOfStock")})</span>
                          )}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            );
          })}

          {manualVariants.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-sm font-medium">
                {hasOptions ? t("otherVariants") : t("variant")}
              </p>
              <Select
                value={selectedManualId ?? ""}
                onValueChange={(val) => handleSelectManual(val)}
              >
                <SelectTrigger className="w-full">
                  {/* Explicit label so it shows pre-hydration. */}
                  <SelectValue placeholder={`- ${t("selectOption")}`}>
                    {selectedManualId
                      ? (() => {
                          const v = manualVariants.find((mv) => mv.id === selectedManualId);
                          return v ? (v.sku ?? `Variant ${v.id.slice(-4)}`) : null;
                        })()
                      : null}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent position="popper">
                  {manualVariants.map((variant) => {
                    const outOfStock = variant.stock === 0;
                    const label = variant.sku ?? `Variant ${variant.id.slice(-4)}`;
                    const priceStr =
                      variant.price !== product.price
                        ? formatPrice(convertCents(variant.price, currency, currentRate()), currency)
                        : null;
                    return (
                      <SelectItem
                        key={variant.id}
                        value={variant.id}
                        className={cn(outOfStock && "text-muted-foreground")}
                      >
                        {label}
                        {priceStr && <span className="ml-1.5 text-xs opacity-75">{priceStr}</span>}
                        {outOfStock && <span className="ml-1 text-xs">({t("outOfStock")})</span>}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          )}
        </>
      ) : (
        /* Pill mode (default) */
        <>
          {product.options.map((option) => {
            const uniqueValues = [...new Set(option.values.map((v) => v.value))];
            const selected = selectedValues[option.id];
            const loc = localizedOption(option);

            return (
              <div key={option.id}>
                <p className="text-sm font-medium mb-2.5">
                  {loc.name}
                  {selected && (
                    <span className="font-normal text-muted-foreground ml-1.5">
                      - {loc.translate(selected)}
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
                          // Every enabled pill is clickable (a selected one
                          // deselects on click), so the pointer cursor lives in
                          // the base; only the disabled state overrides it.
                          "relative px-3 py-1.5 text-sm rounded-md border transition-all select-none cursor-pointer",
                          isSelected &&
                            "border-primary bg-primary text-primary-foreground shadow-sm",
                          !isSelected &&
                            compatible &&
                            inStock &&
                            "border-input bg-background hover:border-primary",
                          !isSelected &&
                            compatible &&
                            !inStock &&
                            "border-input bg-background text-muted-foreground",
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
                        {loc.translate(value)}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

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
                        // Manual variant pills are always clickable (selected
                        // deselects), so the pointer cursor lives in the base.
                        "relative px-3 py-1.5 text-sm rounded-md border transition-all select-none cursor-pointer",
                        isSelected &&
                          "border-primary bg-primary text-primary-foreground shadow-sm",
                        !isSelected &&
                          !outOfStock &&
                          "border-input bg-background hover:border-primary",
                        !isSelected &&
                          outOfStock &&
                          "border-input bg-background text-muted-foreground",
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
                          {formatPrice(convertCents(variant.price, currency, currentRate()), currency)}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </>
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

      {!hideButton && (
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
              : t("addToCart", { price: formatPrice(convertCents(price, currency, currentRate()), currency) })}
          {isOnSale && !isOutOfStock && allOptionsSelected && (
            <span className="ml-2 bg-white/20 text-white text-xs font-bold px-1.5 py-0.5 rounded-4xl">
              -{salePct}%
            </span>
          )}
        </Button>
      )}
    </div>
  );
}
