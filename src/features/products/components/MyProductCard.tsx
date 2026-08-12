"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Copy, ImageOff, Loader2, Pencil, Trash2, Video as VideoIcon } from "lucide-react";
import { HoverImageCycler } from "@/components/product/HoverImageCycler";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ActionButton } from "@/components/ActionButton";
import { toast } from "@/components/ui/sonner";
import { deleteProduct, duplicateProduct } from "@/features/products/actions/products";
import { useCurrencyStore } from "@/store/currency";
import { formatPrice, convertCents } from "@/lib/currency";
import {
  getProductTitle,
  getProductDescription,
} from "@/features/products/utils/translations";
import { getBrandName } from "@/features/brands/utils/translations";
import { BrandLogo, type LogoBackdrop } from "@/features/brands/components/BrandLogo";

type BrandTranslationRow = {
  locale: string;
  name: string;
  slug: string;
  description: string | null;
};
type ProductTranslationRow = {
  locale: string;
  title: string;
  slug: string;
  description: string;
  shortDescription: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
};

interface MyProductCardProps {
  canWrite: boolean;
  product: {
    id: string;
    translations: ProductTranslationRow[];
    price: number;
    compareAtPrice: number | null;
    status: string;
    imageUrls: string[];
    hasVideo?: boolean;
    brand?: {
      translations: BrandTranslationRow[];
      logoUrl: string | null;
      logoUrlDark: string | null;
      logoBackdrop: LogoBackdrop;
      logoBackdropDark: LogoBackdrop;
    } | null;
  };
}

export function MyProductCard({ canWrite, product }: MyProductCardProps) {
  const t = useTranslations("products");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isDeleting, startDelete] = useTransition();
  const [isDuplicating, startDuplicate] = useTransition();

  const { currency, currentRate } = useCurrencyStore();
  const localTitle = getProductTitle(product, locale);
  const localDescription = getProductDescription(product, locale);
  const localBrandName = product.brand ? getBrandName(product.brand, locale) : "";
  const isOnSale =
    product.compareAtPrice != null && product.compareAtPrice > product.price;

  const handleDelete = () => {
    startDelete(async () => {
      const result = await deleteProduct(product.id, null);
      if (result && "error" in result) {
        toast.error(result.message);
      } else {
        queryClient.invalidateQueries({ queryKey: ["products"] });
      }
    });
  };

  const handleDuplicate = () => {
    startDuplicate(async () => {
      const result = await duplicateProduct(product.id);
      if (!("id" in result)) {
        toast.error(result.message);
        return;
      }
      const copyId = result.id;
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success(t("duplicated"), {
        action: {
          label: t("editCopy"),
          onClick: () => router.push(`/${locale}/dashboard/my-products/${copyId}/edit`),
        },
      });
    });
  };

  return (
    <div className="border border-border/50 rounded-lg overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-0.5">
      {/* Only the view area (image + text) is a real link - the actions row
          below has its own real Edit link plus duplicate/delete buttons, and
          nesting an <a> inside another <a> is invalid/unreliable, so it stays
          a sibling instead. className="contents" keeps this Link out of the
          layout flow so it doesn't disturb the block/padding structure below. */}
      <Link
        href={{ pathname: "/dashboard/my-products/[id]", params: { id: product.id } }}
        className="contents cursor-pointer"
      >
      <div className="relative">
        {product.imageUrls.length > 0 ? (
          <>
            <HoverImageCycler
              images={product.imageUrls}
              alt={localTitle}
              className="w-full h-48"
            />
            {product.hasVideo && (
              <div className="pointer-events-none absolute bottom-2 right-2 flex items-center gap-1 rounded-full bg-black/65 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-white shadow">
                <VideoIcon className="h-3 w-3" />
                Video
              </div>
            )}
          </>
        ) : (
          <div className="w-full h-48 flex flex-col items-center justify-center gap-2 bg-muted/50">
            <ImageOff className="h-8 w-8 text-muted-foreground/40" />
            <span className="text-xs text-muted-foreground/40">{t("noImage")}</span>
          </div>
        )}
        {isOnSale && (
          <div className="absolute top-3 left-0 flex flex-col items-start gap-1 pointer-events-none">
            <span className="bg-linear-to-r from-red-500 to-rose-600 text-white text-sm font-black px-4 py-1.5 rounded-r-full shadow-lg shadow-red-500/50 tracking-wider uppercase">
              -{Math.round(((product.compareAtPrice! - product.price) / product.compareAtPrice!) * 100)}%
            </span>
          </div>
        )}
        {product.brand && (
          <div className="absolute top-2 right-2 pointer-events-none">
            <div className="flex items-center gap-2 bg-background/85 backdrop-blur-xs border border-border/60 rounded-full px-2.5 py-1.5 shadow-sm">
              <BrandLogo
                src={product.brand.logoUrl}
                srcDark={product.brand.logoUrlDark}
                backdrop={product.brand.logoBackdrop}
                backdropDark={product.brand.logoBackdropDark}
                name={localBrandName}
                size={20}
                shape="circle"
              />
              <span className="text-xs font-semibold leading-none">{localBrandName}</span>
            </div>
          </div>
        )}
      </div>
      <div className="p-4 pb-2 space-y-2">
        <h2 className="font-semibold">{localTitle}</h2>
        <p className="text-sm text-muted-foreground line-clamp-2">
          {localDescription}
        </p>
        <div className="flex items-center justify-between">
          {isOnSale ? (
            <div className="flex items-baseline gap-1.5">
              <p className="text-sm font-medium text-red-500">{formatPrice(convertCents(product.price, currency, currentRate()), currency)}</p>
              <p className="text-xs text-muted-foreground line-through">{formatPrice(convertCents(product.compareAtPrice!, currency, currentRate()), currency)}</p>
            </div>
          ) : (
            <p className="text-sm font-medium">{formatPrice(convertCents(product.price, currency, currentRate()), currency)}</p>
          )}
          <Badge
            variant={
              product.status === "PUBLISHED"
                ? "default"
                : product.status === "DRAFT"
                  ? "secondary"
                  : "destructive"
            }
          >
            {product.status === "PUBLISHED" ? t("published") : product.status === "DRAFT" ? t("draft") : t("archived")}
          </Badge>
        </div>
      </div>
      </Link>
      <div className="px-4 pb-4">
        <div className="flex gap-1.5">
          <Button asChild variant="outline" size="sm" className="flex-1 gap-1.5">
            <Link href={{ pathname: "/dashboard/my-products/[id]/edit", params: { id: product.id } }}>
              <Pencil className="h-3.5 w-3.5" />
              {canWrite ? t("edit") : t("view")}
            </Link>
          </Button>
          {canWrite && (
            <>
              <Button
                variant="outline"
                size="sm"
                disabled={isDuplicating}
                onClick={handleDuplicate}
                className="flex-1 gap-1.5"
              >
                {isDuplicating ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                {isDuplicating ? t("duplicating") : t("duplicate")}
              </Button>
              <ActionButton
                title={t("deleteProduct")}
                description={t("deleteConfirm", { title: localTitle })}
                confirmText={tCommon("delete")}
                loadingText={t("deleting")}
                isLoading={isDeleting}
                onConfirm={handleDelete}
              >
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={isDeleting}
                  className="flex-1 gap-1.5"
                >
                  {isDeleting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                  {isDeleting ? t("deleting") : tCommon("delete")}
                </Button>
              </ActionButton>
            </>
          )}
        </div>
      </div>
    </div>
  );
}