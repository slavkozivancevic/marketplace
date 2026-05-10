"use client";

import React from "react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { SerializedProductWithRelations } from "@/types/types";
import { ProductStatusActions } from "./ProductStatusActions";
import { ProductImageCarousel } from "@/components/product/ProductImageCarousel";
import { useCurrencyStore } from "@/store/currency";
import { formatPrice, convertCents } from "@/lib/currency";

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
  const { currency, currentRate } = useCurrencyStore();
  return (
    <div className="space-y-6">
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
          <div>
            <strong>{t("titleLabel")}</strong> {product.title}
          </div>
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
          <div>
            <strong>{t("descLabel")}</strong> {product.description || "—"}
          </div>
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
          <div>
            <strong>{t("priceLabel")}</strong> {formatPrice(convertCents(product.price, currency, currentRate()), currency)}
          </div>
          {product.variants?.length === 0 && (
            <div>
              <strong>{t("stockLabel")}</strong>{" "}
              {product.stock !== null ? product.stock : t("unlimited")}
            </div>
          )}
          <div>
            <strong>{t("version")}</strong> {product.version}
          </div>
        </CardContent>
      </Card>

      <Separator />

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

      {product.options?.length > 0 && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>{t("options")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {product.options.map((option) => (
                <div key={option.id} className="flex items-center gap-2">
                  <span className="text-sm font-medium w-20">
                    {option.name}:
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {Array.from(new Set(option.values.map((v) => v.value))).map(
                      (value) => (
                        <Badge key={value} variant="secondary">
                          {value}
                        </Badge>
                      ),
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
          <Separator />
        </>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t("variants", { count: product.variants?.length ?? 0 })}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {product.variants?.length ? (
            product.variants.map((variant) => (
              <div key={variant.id} className="border p-3 rounded space-y-1">
                <div className="flex items-center gap-4 text-sm">
                  <span>
                    <strong>{t("sku")}</strong> {variant.sku}
                  </span>
                  <span>
                    <strong>{t("priceLabel")}</strong> {formatPrice(convertCents(variant.price, currency, currentRate()), currency)}
                  </span>
                  <span>
                    <strong>{t("stockLabel")}</strong> {variant.stock}
                  </span>
                </div>
                {variant.optionValues?.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {variant.optionValues.map((ov) => (
                      <Badge key={ov.id} variant="outline">
                        {ov.value}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">
              {t("noVariants")}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

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