"use client";

import type { ReactNode } from "react";
import { useParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { getPathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs, type BreadcrumbItem } from "@/components/seo/Breadcrumbs";
import { SkeletonBreadcrumbs, SkeletonButton } from "@/components/ui/skeleton";
import { productDetailsHint } from "@/features/products/productDetailsHint";
import { getProductTitle } from "@/features/products/utils/translations";
import { ProductBasicInfoCard, type BasicInfoSource } from "./ProductBasicInfoCard";

type Locale = (typeof routing.locales)[number];

function useHintedProduct(): { id: string | undefined; product: BasicInfoSource | undefined } {
  const params = useParams<{ id?: string }>();
  return { id: params?.id, product: productDetailsHint(params?.id) };
}

/**
 * <ProductStatusActions>' buttons as placeholders - the same labels for the
 * same status, so the card header wraps exactly where the loaded one will.
 */
export function ProductStatusActionsPlaceholder({ status }: { status: BasicInfoSource["status"] }) {
  const t = useTranslations("products");
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {status === "DRAFT" && <SkeletonButton size="sm" label={t("publish")} />}
      {status === "PUBLISHED" && (
        <>
          <SkeletonButton size="sm" label={t("unpublish")} />
          <SkeletonButton size="sm" label={t("archive")} />
        </>
      )}
      {status === "ARCHIVED" && <SkeletonButton size="sm" label={t("restoreToDraft")} />}
      <SkeletonButton size="sm" label={t("deleteProduct")} />
    </div>
  );
}

/**
 * The detail page's "Basic information" card while it loads: the real card,
 * drawn from the list row that was clicked, or `children` (the generic
 * placeholder) when nothing recorded the product.
 */
export function HintedBasicInfo({
  showActions,
  children,
}: {
  showActions: boolean;
  children: ReactNode;
}) {
  const { product } = useHintedProduct();
  if (!product) return children;
  return (
    <ProductBasicInfoCard
      product={product}
      actions={showActions ? <ProductStatusActionsPlaceholder status={product.status} /> : null}
    />
  );
}

/**
 * The detail page's header while it loads. With the clicked row's product it
 * is the loaded header: the product's title as the heading and the last crumb.
 * Without one it is the page's generic title, over placeholder crumbs (the
 * route's loading.tsx) or the generic crumb (the page's own fallback).
 */
export function ProductDetailLoadingHeader({
  area,
  baseCrumbs,
  genericTitle,
  genericCrumb,
  description,
  placeholderCrumbs = false,
  children,
}: {
  area: "admin" | "dashboard";
  baseCrumbs: BreadcrumbItem[];
  genericTitle: string;
  genericCrumb: string;
  description: string;
  placeholderCrumbs?: boolean;
  children?: ReactNode;
}) {
  const locale = useLocale() as Locale;
  const { id, product } = useHintedProduct();
  const title = product ? getProductTitle(product, locale) : "";
  const detailHref = id
    ? getPathname({
        href:
          area === "admin"
            ? { pathname: "/admin/products/[id]", params: { id } }
            : { pathname: "/dashboard/my-products/[id]", params: { id } },
        locale,
      })
    : "";

  return (
    <div className="shrink-0 px-6 pt-2 sticky-header-bg">
      {product || !placeholderCrumbs ? (
        <Breadcrumbs
          items={[...baseCrumbs, { name: title || genericCrumb, href: detailHref }]}
          seo={false}
        />
      ) : (
        <SkeletonBreadcrumbs segments={baseCrumbs.length + 1} />
      )}
      <PageHeader title={product ? title : genericTitle} description={description}>
        {children}
      </PageHeader>
    </div>
  );
}
