"use client";

import React from "react";
import { useTranslations, useLocale } from "next-intl";
import { BrandLogo } from "@/features/brands/components/BrandLogo";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { SerializedProductWithRelations } from "@/types/types";
import { ProductStatusActions } from "./ProductStatusActions";
import { ProductImageCarousel } from "@/components/product/ProductImageCarousel";
import { useCurrencyStore } from "@/store/currency";
import { formatPrice, convertCents } from "@/lib/currency";
import { getCategoryName } from "@/features/categories/utils/translations";
import { getTagName } from "@/features/tags/utils/translations";
import { getLabel } from "@/features/attributes/utils/translations";
import { getBrandName } from "@/features/brands/utils/translations";
import {
  getProductTitle,
  getProductSlug,
  getProductDescription,
  getProductShortDescription,
  getProductMetaTitle,
  getProductMetaDescription,
} from "@/features/products/utils/translations";

interface ProductDetailsProps {
  product: SerializedProductWithRelations;
  showActions?: boolean;
  redirectTo?: string;
}

export const ProductDetails: React.FC<ProductDetailsProps> = ({
  product,
  showActions = true,
  redirectTo,
}) => {
  const t = useTranslations("products");
  const tf = useTranslations("productForm");
  const locale = useLocale();
  const { currency, currentRate } = useCurrencyStore();

  const rate = currentRate();
  const fmt = (cents: number) => formatPrice(convertCents(cents, currency, rate), currency);

  const localTitle = getProductTitle(product, locale);
  const localSlug = getProductSlug(product, locale);
  const localDescription = getProductDescription(product, locale);
  const localShortDescription = getProductShortDescription(product, locale);
  const localMetaTitle = getProductMetaTitle(product, locale);
  const localMetaDescription = getProductMetaDescription(product, locale);
  const localBrandName = product.brand ? getBrandName(product.brand, locale) : "";

  return (
    <div className="space-y-6">
      {/* ── BASIC INFO ── */}
      <Card>
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>{t("basicInfo")}</CardTitle>
          {showActions && (
            <ProductStatusActions
              productId={product.id}
              status={product.status}
              redirectTo={redirectTo}
            />
          )}
        </CardHeader>
        <CardContent className="space-y-2">
          <Row label={t("titleLabel")} value={localTitle} />
          {localSlug && (
            <Row label={tf("slug")} value={localSlug} mono />
          )}
          {localShortDescription && (
            <Row label={tf("shortDesc")} value={localShortDescription} />
          )}
          {product.brand && (
            <div className="flex items-center gap-2">
              <strong>{t("brandLabel")}</strong>
              <BrandLogo
                src={product.brand.logoUrl}
                srcDark={product.brand.logoUrlDark}
                backdrop={product.brand.logoBackdrop}
                backdropDark={product.brand.logoBackdropDark}
                name={localBrandName}
                size={20}
              />
              <span>{localBrandName}</span>
            </div>
          )}
          {product.categories?.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <strong>{t("categoriesLabel")}</strong>
              {product.categories.map((c) => (
                <Badge key={c.categoryId} variant="secondary">
                  {getCategoryName(c.category, locale)}
                </Badge>
              ))}
            </div>
          )}
          {product.tags?.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <strong>{t("tagsLabel")}</strong>
              {product.tags.map((pt) => (
                <Badge key={pt.tagId} variant="secondary">
                  {getTagName(pt.tag, locale)}
                </Badge>
              ))}
            </div>
          )}
          <Row label={t("descLabel")} value={localDescription || "-"} />
          <div>
            <strong>{t("statusLabel")}</strong>{" "}
            <Badge variant={getStatusBadgeVariant(product.status)}>
              {product.status === "PUBLISHED"
                ? t("published")
                : product.status === "DRAFT"
                  ? t("draft")
                  : t("archived")}
            </Badge>
          </div>
          <Row label={t("version")} value={String(product.version)} />
        </CardContent>
      </Card>

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
          <Row label={t("priceLabel")} value={fmt(product.price)} />
          {product.compareAtPrice != null && (
            <Row label={tf("compareAtPrice")} value={fmt(product.compareAtPrice)} />
          )}
          {product.costPrice != null && (
            <Row label={tf("costPrice")} value={fmt(product.costPrice)} />
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
                  <span><strong>{t("priceLabel")}</strong> {fmt(variant.price)}</span>
                  {variant.compareAtPrice != null && (
                    <span><strong>{tf("compareAtPrice")}</strong> {fmt(variant.compareAtPrice)}</span>
                  )}
                  {variant.costPrice != null && (
                    <span><strong>{tf("costPrice")}</strong> {fmt(variant.costPrice)}</span>
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

function Row({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  const displayLabel = label.endsWith(":") ? label : `${label}:`;
  return (
    <div>
      <strong>{displayLabel}</strong>{" "}
      {mono ? <code className="text-sm">{value}</code> : value}
    </div>
  );
}

function getStatusBadgeVariant(status: string) {
  switch (status) {
    case "DRAFT":
      return "secondary";
    case "ARCHIVED":
      return "destructive";
    case "PUBLISHED":
    default:
      return "default";
  }
}
