"use client";

import React from "react";
import { useTranslations, useLocale } from "next-intl";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { SerializedProductWithRelations } from "@/types/types";
import { ProductStatusActions } from "./ProductStatusActions";
import { ProductBasicInfoCard, Row } from "./ProductBasicInfoCard";
import { ProductImageCarousel } from "@/components/product/ProductImageCarousel";
import { useMoney } from "@/lib/useMoney";
import { getLabel } from "@/features/attributes/utils/translations";
import { countryName } from "@/lib/i18n/countries";
import { buildAttributeSpecRows } from "./ProductSpecifications";
import {
  getProductTitle,
  getProductMetaTitle,
  getProductMetaDescription,
} from "@/features/products/utils/translations";

interface ProductDetailsProps {
  product: SerializedProductWithRelations;
  showActions?: boolean;
  /**
   * The product list this page hangs off, without the locale prefix. Only a
   * delete uses it - see {@link ProductStatusActions}. Required whenever
   * `showActions` is on, because the two surfaces (admin, seller dashboard)
   * have different lists and neither one is a safe default for the other.
   */
  deletedRedirectTo?: string;
}

export const ProductDetails: React.FC<ProductDetailsProps> = ({
  product,
  showActions = true,
  deletedRedirectTo,
}) => {
  const t = useTranslations("products");
  const tf = useTranslations("productForm");
  const locale = useLocale();
  // Reads the stored amount for the active currency - no rate involved, so
  // what the seller typed is what this panel shows.
  const { format: fmt } = useMoney();
  // Same rows, same order, same formatting the storefront shows the buyer.
  const attributeRows = buildAttributeSpecRows(product.attributeValues ?? [], locale, t);

  const localTitle = getProductTitle(product, locale);
  const localMetaTitle = getProductMetaTitle(product, locale);
  const localMetaDescription = getProductMetaDescription(product, locale);

  return (
    <div className="space-y-6">
      {/* ── BASIC INFO ── */}
      <ProductBasicInfoCard
        product={product}
        actions={
          showActions ? (
            <ProductStatusActions
              productId={product.id}
              status={product.status}
              deletedRedirectTo={deletedRedirectTo ?? null}
            />
          ) : null
        }
      />

      <Separator />

      {/* ── MEDIA ── */}
      <Card>
        <CardHeader>
          <CardTitle>{t("media")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ProductImageCarousel
            media={product.media ?? []}
            title={localTitle}
          />
        </CardContent>
      </Card>

      <Separator />

      {/* ── PRICING & INVENTORY ── */}
      <Card>
        <CardHeader>
          <CardTitle>{tf("tabPricing")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Row label={t("priceLabel")} value={fmt(product.priceMoney)} />
          {product.compareAtPrice != null && (
            <Row label={tf("compareAtPrice")} value={fmt(product.compareAtPriceMoney)} />
          )}
          {product.costPrice != null && (
            <Row label={tf("costPrice")} value={fmt(product.costPriceMoney)} />
          )}
          {product.variants?.length === 0 && (
            <Row
              label={t("stockLabel")}
              value={product.stock !== null ? String(product.stock) : t("unlimited")}
            />
          )}
          {product.barcode && (
            <Row label={tf("barcode")} value={product.barcode} mono />
          )}
          <div>
            <strong>{tf("chargeTaxes")}</strong>{" "}
            <Badge variant={product.taxable ? "default" : "secondary"}>
              {product.taxable ? tf("yes") : tf("no")}
            </Badge>
          </div>
          {product.taxCode && (
            <Row label={tf("taxCode")} value={product.taxCode} mono />
          )}
        </CardContent>
      </Card>

      <Separator />

      {/* ── SHIPPING ── */}
      <Card>
        <CardHeader>
          <CardTitle>{tf("tabShipping")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div>
            <strong>{tf("digitalProduct")}</strong>{" "}
            <Badge variant={product.isDigital ? "default" : "secondary"}>
              {product.isDigital ? tf("yes") : tf("no")}
            </Badge>
          </div>
          {!product.isDigital && (
            <div>
              <strong>{tf("requiresShipping")}</strong>{" "}
              <Badge variant={product.requiresShipping ? "default" : "secondary"}>
                {product.requiresShipping ? tf("yes") : tf("no")}
              </Badge>
            </div>
          )}
          {product.requiresShipping && !product.isDigital && (
            <>
              {product.weight != null && (
                <Row
                  label={tf("weight")}
                  value={`${product.weight} ${product.weightUnit ?? ""}`}
                />
              )}
              {(product.length != null || product.width != null || product.height != null) && (
                <Row
                  label={tf("dimensions")}
                  value={[
                    product.length != null ? `L: ${product.length}` : null,
                    product.width != null ? `W: ${product.width}` : null,
                    product.height != null ? `H: ${product.height}` : null,
                  ]
                    .filter(Boolean)
                    .join("  ") + (product.dimensionUnit ? ` ${product.dimensionUnit}` : "")}
                />
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Separator />

      {/* ── SPECIFICATIONS ──
          Mirrors what the storefront's Specifications tab shows the buyer:
          the platform-owned rows plus the category-driven attribute values.
          The seller could previously see variant attribute values but never
          the product's own, so there was no way to check this from here. */}
      {(product.warrantyMonths != null ||
        product.countryOfOrigin ||
        attributeRows.length > 0) && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>{tf("specificationsSection")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {product.warrantyMonths != null && (
                <Row
                  label={tf("warrantyMonths")}
                  value={
                    product.warrantyMonths === 0
                      ? tf("noWarranty")
                      : tf("warrantyMonthsValue", { count: product.warrantyMonths })
                  }
                />
              )}
              {product.countryOfOrigin && (
                <Row
                  label={tf("countryOfOrigin")}
                  value={countryName(product.countryOfOrigin, locale)}
                />
              )}
              {attributeRows.map((row) => (
                <Row key={row.key} label={row.label} value={row.value} />
              ))}
            </CardContent>
          </Card>
          <Separator />
        </>
      )}

      {/* ── SEO ── */}
      {(localMetaTitle || localMetaDescription) && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>{tf("tabSeo")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {localMetaTitle && (
                <Row label={tf("metaTitle")} value={localMetaTitle} />
              )}
              {localMetaDescription && (
                <Row label={tf("metaDescription")} value={localMetaDescription} />
              )}
            </CardContent>
          </Card>
          <Separator />
        </>
      )}

      {/* ── VARIANTS ── */}
      <Card>
        <CardHeader>
          <CardTitle>{t("variants", { count: product.variants?.length ?? 0 })}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {product.variants?.length ? (
            product.variants.map((variant) => (
              <div key={variant.id} className="border p-3 rounded space-y-1.5">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                  <span><strong>{t("sku")}</strong> {variant.sku}</span>
                  <span><strong>{t("priceLabel")}</strong> {fmt(variant.priceMoney)}</span>
                  {variant.compareAtPrice != null && (
                    <span><strong>{tf("compareAtPrice")}</strong> {fmt(variant.compareAtPriceMoney)}</span>
                  )}
                  {variant.costPrice != null && (
                    <span><strong>{tf("costPrice")}</strong> {fmt(variant.costPriceMoney)}</span>
                  )}
                  <span><strong>{t("stockLabel")}</strong> {variant.stock}</span>
                  {variant.barcode && (
                    <span><strong>{tf("barcode")}</strong> <code className="text-xs">{variant.barcode}</code></span>
                  )}
                  {variant.weight != null && (
                    <span><strong>{tf("weight")}</strong> {variant.weight} {variant.weightUnit ?? ""}</span>
                  )}
                </div>
                {variant.attributeValues?.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {variant.attributeValues.map((av) => (
                      <Badge key={av.id} variant="outline">
                        {getLabel(av.option.translations, locale)}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">{t("noVariants")}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

