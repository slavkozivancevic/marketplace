"use client";

import type { ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BrandLogo, type LogoBackdrop } from "@/features/brands/components/BrandLogo";
import { getBrandName } from "@/features/brands/utils/translations";
import { getCategoryName } from "@/features/categories/utils/translations";
import { getTagName } from "@/features/tags/utils/translations";
import {
  getProductDescription,
  getProductShortDescription,
  getProductSlug,
  getProductTitle,
} from "@/features/products/utils/translations";

type Named = { locale: string; name: string };

/**
 * What the "Basic information" card reads. The product detail page passes the
 * full product; its loading state passes the admin/dashboard list row the
 * buyer clicked (see `productDetailsHint`), which carries exactly these fields.
 */
export type BasicInfoSource = {
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  version: number;
  translations: readonly {
    locale: string;
    title: string;
    slug: string;
    description: string;
    shortDescription: string | null;
  }[];
  brand: {
    logoUrl: string | null;
    logoUrlDark: string | null;
    logoBackdrop: LogoBackdrop;
    logoBackdropDark: LogoBackdrop;
    translations: readonly Named[];
  } | null;
  categories?: readonly { categoryId: string; category: { translations: readonly Named[] } }[];
  tags?: readonly { tagId: string; tag: { translations: readonly Named[] } }[];
};

/** One `Label: value` line of the product detail cards. */
export function Row({
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

export function getStatusBadgeVariant(status: string) {
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

/**
 * The product detail page's first card. One component for the page and its
 * loading state, so a product whose list row was clicked loads with this card
 * already exactly as the page draws it - every value wraps where it will.
 * `actions` is the status buttons: the real ones on the page, placeholders of
 * the same labels while loading.
 */
export function ProductBasicInfoCard({
  product,
  actions,
}: {
  product: BasicInfoSource;
  actions?: ReactNode;
}) {
  const t = useTranslations("products");
  const tf = useTranslations("productForm");
  const locale = useLocale();

  const localTitle = getProductTitle(product, locale);
  const localSlug = getProductSlug(product, locale);
  const localDescription = getProductDescription(product, locale);
  const localShortDescription = getProductShortDescription(product, locale);
  const localBrandName = product.brand ? getBrandName(product.brand, locale) : "";

  return (
    <Card>
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle>{t("basicInfo")}</CardTitle>
        {actions}
      </CardHeader>
      <CardContent className="space-y-2">
        <Row label={t("titleLabel")} value={localTitle} />
        {localSlug && <Row label={tf("slug")} value={localSlug} mono />}
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
        {(product.categories?.length ?? 0) > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <strong>{t("categoriesLabel")}</strong>
            {product.categories!.map((c) => (
              <Badge key={c.categoryId} variant="secondary">
                {getCategoryName(c.category, locale)}
              </Badge>
            ))}
          </div>
        )}
        {(product.tags?.length ?? 0) > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <strong>{t("tagsLabel")}</strong>
            {product.tags!.map((pt) => (
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
  );
}
