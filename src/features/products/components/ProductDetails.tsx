"use client";

import React from "react";
import { useTranslations, useLocale } from "next-intl";
import Image from "next/image";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { SerializedProductWithRelations } from "@/types/types";
import { ProductStatusActions } from "./ProductStatusActions";
import { ProductImageCarousel } from "@/components/product/ProductImageCarousel";
import { useCurrencyStore } from "@/store/currency";
import { formatPrice, convertCents } from "@/lib/currency";
import { getCategoryName, type CategoryTranslations } from "@/features/categories/utils/translations";

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

  return (
    <div className="space-y-6">
      {/* ── BASIC INFO ── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
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
          <Row label={t("titleLabel")} value={product.title} />
          {product.slug && (
            <Row label={tf("slug")} value={product.slug} mono />
          )}
          {product.shortDescription && (
            <Row label={tf("shortDesc")} value={product.shortDescription} />
          )}
          {product.brand && (
            <div className="flex items-center gap-2">
              <strong>{t("brandLabel")}</strong>
              {product.brand.logoUrl && (
                <div className="relative h-5 w-5 overflow-hidden rounded-sm border bg-muted shrink-0">
                  <Image
                    src={product.brand.logoUrl}
                    alt={product.brand.name}
                    fill
                    sizes="20px"
                    className="object-contain"
                  />
                </div>
              )}
              <span>{product.brand.name}</span>
            </div>
          )}
          {product.categories?.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <strong>{t("categoriesLabel")}</strong>
              {product.categories.map((c) => (
                <Badge key={c.categoryId} variant="secondary">
                  {getCategoryName(
                    { ...c.category, translations: c.category.translations as CategoryTranslations | null },
                    locale,
                  )}
                </Badge>
              ))}
            </div>
          )}
          <Row label={t("descLabel")} value={product.description || "—"} />
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

      {/* ── IMAGES ── */}
      <Card>
        <CardHeader>
          <CardTitle>{t("images")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ProductImageCarousel
            images={product.images ?? []}
            title={product.title}
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
      {(product.metaTitle || product.metaDescription) && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>{tf("tabSeo")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {product.metaTitle && (
                <Row label={tf("metaTitle")} value={product.metaTitle} />
              )}
              {product.metaDescription && (
                <Row label={tf("metaDescription")} value={product.metaDescription} />
              )}
            </CardContent>
          </Card>
          <Separator />
        </>
      )}

      {/* ── OPTIONS ── */}
      {product.options?.length > 0 && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>{t("options")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {product.options.map((option) => (
                <div key={option.id} className="flex items-center gap-2">
                  <span className="text-sm font-medium w-20">{option.name}:</span>
                  <div className="flex flex-wrap gap-1">
                    {Array.from(new Set(option.values.map((v) => v.value))).map((value) => (
                      <Badge key={value} variant="secondary">{value}</Badge>
                    ))}
                  </div>
                </div>
              ))}
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
                {variant.optionValues?.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {variant.optionValues.map((ov) => (
                      <Badge key={ov.id} variant="outline">{ov.value}</Badge>
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
