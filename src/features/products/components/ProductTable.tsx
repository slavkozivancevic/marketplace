"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Copy, ImageOff, Loader2, Pencil, Trash2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "@/components/ui/sonner";
import { BrandLogo } from "@/features/brands/components/BrandLogo";
import { LoadingImage } from "@/components/ui/LoadingImage";
import { deleteProduct, duplicateProduct } from "@/features/products/actions/products";
import { SerializedProductListItem } from "@/types/types";
import { useCurrencyStore } from "@/store/currency";
import { formatPrice, convertCents } from "@/lib/currency";
import {
  getProductTitle,
  getProductDescription,
} from "@/features/products/utils/translations";
import { getBrandName } from "@/features/brands/utils/translations";

function getStatusVariant(status: string) {
  switch (status) {
    case "PUBLISHED":
      return "default" as const;
    case "DRAFT":
      return "secondary" as const;
    default:
      return "destructive" as const;
  }
}

const COLS_BASE = "64px minmax(100px,1fr) 120px minmax(150px,2fr) 120px 100px";
const COLS_ACTIONS = COLS_BASE + " 116px";

/**
 * Product table header (rendered outside the virtualizer scroll container).
 */
export function ProductTableHeader({
  showActions = false,
}: {
  showActions?: boolean;
}) {
  const t = useTranslations("products");
  const cols = showActions ? COLS_ACTIONS : COLS_BASE;

  return (
    <div
      role="row"
      className="grid items-center gap-4 border-b p-3 text-sm font-medium text-muted-foreground shrink-0 bg-background rounded-t-lg sticky top-0 z-10 min-w-fit"
      style={{ gridTemplateColumns: cols }}
    >
      <div role="columnheader" className="truncate">{t("image")}</div>
      <div role="columnheader" className="truncate">{t("titleHeader")}</div>
      <div role="columnheader" className="truncate">{t("brand")}</div>
      <div role="columnheader" className="truncate">{t("descriptionHeader")}</div>
      <div role="columnheader" className="truncate text-right">{t("price")}</div>
      <div role="columnheader" className="truncate text-center">{t("status")}</div>
      {showActions && (
        // pr-2.5 (10px) compensates for the icon Button's internal padding:
        // a 16x16 icon inside a 36x36 ghost button leaves ~10px of empty
        // space on each side, so without this the header label sits to the
        // right of the trash icon's visible edge instead of aligned with it.
        <div role="columnheader" className="truncate text-right pr-2.5">{t("actions")}</div>
      )}
    </div>
  );
}

/**
 * A single product row, compatible with virtualization (uses div instead of tr).
 */
export function ProductTableRow({
  product,
  showActions = false,
  basePath = "/admin/products",
  onBusyChange,
}: {
  product: SerializedProductListItem;
  showActions?: boolean;
  basePath?: string;
  onBusyChange?: (id: string, busy: boolean) => void;
}) {
  const t = useTranslations("products");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isDeleting, startDelete] = useTransition();
  const [isDuplicating, startDuplicate] = useTransition();
  const [isNavigating, startNavigate] = useTransition();
  const { currency, currentRate } = useCurrencyStore();
  const [deleteOpen, setDeleteOpen] = useState(false);

  const localTitle = getProductTitle(product, locale);
  const localDescription = getProductDescription(product, locale);
  const localBrandName = product.brand ? getBrandName(product.brand, locale) : "";

  // Auto-close the confirm dialog once the in-flight delete finishes.
  const wasDeleting = useRef(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (wasDeleting.current && !isDeleting) setDeleteOpen(false);
    wasDeleting.current = isDeleting;
  }, [isDeleting]);

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
          onClick: () => router.push(`/${locale}${basePath}/${copyId}/edit`),
        },
      });
    });
  };

  // Table row thumbnail prefers the server thumb (image thumbnail OR video
  // poster), falling back to the original URL for legacy rows.
  const firstMedia = product.media?.[0];
  const thumbnailUrl = firstMedia?.thumbUrl ?? firstMedia?.url;
  const cols = showActions ? COLS_ACTIONS : COLS_BASE;
  const isBusy = isDeleting || isDuplicating || isNavigating;

  // Report busy state up so the list can lock the whole table while any
  // row has an action in flight (prevents racing navigations/mutations
  // when the user clicks other rows mid-action).
  useEffect(() => {
    onBusyChange?.(product.id, isBusy);
    return () => onBusyChange?.(product.id, false);
  }, [isBusy, product.id, onBusyChange]);

  return (
    <div
      role="row"
      className={cn(
        "grid items-center gap-4 border-b p-3 transition-all min-w-fit",
        isBusy
          ? "opacity-50 pointer-events-none cursor-default"
          : "cursor-pointer hover:bg-muted/50",
      )}
      style={{ gridTemplateColumns: cols }}
      onClick={() => !isBusy && router.push(`/${locale}${basePath}/${product.id}`)}
    >
      <div role="cell">
        {thumbnailUrl ? (
          <div className="relative h-12 w-12 overflow-hidden rounded border bg-muted">
            <LoadingImage
              src={thumbnailUrl}
              alt={localTitle}
              fill
              sizes="48px"
              className="object-cover"
            />
          </div>
        ) : (
          <div className="h-12 w-12 rounded border bg-muted flex flex-col items-center justify-center gap-0.5">
            <ImageOff className="h-4 w-4 text-muted-foreground/40" />
            <span className="text-[8px] text-muted-foreground/40">{t("noImage")}</span>
          </div>
        )}
      </div>
      <div role="cell" className="truncate">{localTitle}</div>
      <div role="cell">
        {product.brand ? (
          <div className="flex items-center gap-1.5 min-w-0">
            <BrandLogo
              src={product.brand.logoUrl}
              srcDark={product.brand.logoUrlDark}
              backdrop={product.brand.logoBackdrop}
              backdropDark={product.brand.logoBackdropDark}
              name={localBrandName}
              size={20}
            />
            <span className="truncate text-sm">{localBrandName}</span>
          </div>
        ) : (
          <span className="text-muted-foreground text-sm">-</span>
        )}
      </div>
      <div role="cell" className="truncate text-muted-foreground">
        {localDescription}
      </div>
      <div role="cell" className="text-right tabular-nums">
        {formatPrice(convertCents(product.price, currency, currentRate()), currency)}
      </div>
      <div role="cell" className="flex justify-center">
        <Badge variant={getStatusVariant(product.status)}>
          {product.status === "PUBLISHED" ? t("published") : product.status === "DRAFT" ? t("draft") : t("archived")}
        </Badge>
      </div>
      {showActions && (
        <div role="cell" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-end gap-1">
            <Button
              variant="ghost"
              size="icon"
              disabled={isNavigating}
              onClick={() => startNavigate(() => router.push(`/${locale}${basePath}/${product.id}/edit`))}
            >
              {isNavigating
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Pencil className="h-4 w-4" />}
              <span className="sr-only">{tCommon("edit")}</span>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              disabled={isDuplicating}
              onClick={handleDuplicate}
              title={t("duplicate")}
            >
              {isDuplicating
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Copy className="h-4 w-4" />}
              <span className="sr-only">{t("duplicate")}</span>
            </Button>
            <AlertDialog
              open={deleteOpen}
              onOpenChange={(next) => {
                if (isDeleting) return;
                setDeleteOpen(next);
              }}
            >
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" disabled={isDeleting}>
                  {isDeleting
                    ? <Loader2 className="h-4 w-4 animate-spin text-destructive" />
                    : <Trash2 className="h-4 w-4 text-destructive" />}
                  <span className="sr-only">{tCommon("delete")}</span>
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t("deleteConfirm", { title: localTitle })}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {t("cannotUndo")}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={isDeleting}>{tCommon("cancel")}</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={(e) => {
                      e.preventDefault();
                      handleDelete();
                    }}
                    disabled={isDeleting}
                    variant="destructiveSolid"
                  >
                    {isDeleting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {t("deleting")}
                      </>
                    ) : (
                      tCommon("delete")
                    )}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      )}
    </div>
  );
}