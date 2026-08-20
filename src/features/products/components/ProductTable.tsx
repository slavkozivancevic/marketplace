"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
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
import { TruncatedTooltip } from "@/components/TruncatedTooltip";
import { BrandLogo } from "@/features/brands/components/BrandLogo";
import { RetryImage } from "@/components/RetryImage";
import { deleteProduct, duplicateProduct } from "@/features/products/actions/products";
import { SerializedAdminProductListItem } from "@/types/types";
import { useCurrencyStore } from "@/store/currency";
import { formatPrice, convertCents } from "@/lib/currency";
import {
  getProductTitle,
  getProductDescription,
} from "@/features/products/utils/translations";
import { getBrandName } from "@/features/brands/utils/translations";
// The grid template is owned by the skeleton module (see the note there): the
// real header/row and the loading placeholder read the SAME builder, so adding
// a column here can't leave the skeleton behind.
import { buildProductTableCols } from "./ProductTableSkeleton";

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

/**
 * Product table header (rendered outside the virtualizer scroll container).
 */
export function ProductTableHeader({
  showActions = false,
  showCreatedBy = false,
}: {
  showActions?: boolean;
  showCreatedBy?: boolean;
}) {
  const t = useTranslations("products");
  const cols = buildProductTableCols(showCreatedBy, showActions);

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
      {showCreatedBy && (
        <div role="columnheader" className="truncate">{t("createdBy")}</div>
      )}
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
  showCreatedBy = false,
  basePath = "/admin/products",
  onBusyChange,
}: {
  product: SerializedAdminProductListItem;
  showActions?: boolean;
  showCreatedBy?: boolean;
  basePath?: "/admin/products" | "/dashboard/my-products";
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
  const cols = buildProductTableCols(showCreatedBy, showActions);
  const isBusy = isDeleting || isDuplicating || isNavigating;

  // Report busy state up so the list can lock the whole table while any
  // row has an action in flight (prevents racing navigations/mutations
  // when the user clicks other rows mid-action).
  useEffect(() => {
    onBusyChange?.(product.id, isBusy);
    return () => onBusyChange?.(product.id, false);
  }, [isBusy, product.id, onBusyChange]);

  const viewHref =
    basePath === "/dashboard/my-products"
      ? { pathname: "/dashboard/my-products/[id]" as const, params: { id: product.id } }
      : { pathname: "/admin/products/[id]" as const, params: { id: product.id } };

  return (
    // display:contents keeps this Link out of the CSS grid layout below - the
    // grid columns are on the row div, not this wrapper - while giving the
    // row a real <a> for NavigationProgress's click detection to see. The
    // isBusy guard lives in this onClick (not just the inner div's
    // pointer-events-none) because pointer-events:none on a descendant lets
    // the click fall through to this ancestor anchor instead of blocking it.
    <Link href={viewHref} className="contents" onClick={(e) => isBusy && e.preventDefault()}>
    <div
      role="row"
      className={cn(
        "grid items-center gap-4 border-b p-3 transition-all min-w-fit",
        isBusy
          ? "opacity-50 pointer-events-none cursor-default"
          : "cursor-pointer hover:bg-muted/50",
      )}
      style={{ gridTemplateColumns: cols }}
    >
      <div role="cell">
        {thumbnailUrl ? (
          <div className="relative h-12 w-12 overflow-hidden rounded border bg-muted">
            <RetryImage
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
      <TruncatedTooltip content={localTitle}>
        <div role="cell" className="truncate">{localTitle}</div>
      </TruncatedTooltip>
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
            <TruncatedTooltip content={localBrandName}>
              <span className="truncate text-sm">{localBrandName}</span>
            </TruncatedTooltip>
          </div>
        ) : (
          <span className="text-muted-foreground text-sm">-</span>
        )}
      </div>
      <TruncatedTooltip content={localDescription}>
        <div role="cell" className="truncate text-muted-foreground">
          {localDescription}
        </div>
      </TruncatedTooltip>
      <div role="cell" className="text-right tabular-nums">
        {formatPrice(convertCents(product.price, currency, currentRate()), currency)}
      </div>
      <div role="cell" className="flex justify-center">
        <Badge variant={getStatusVariant(product.status)}>
          {product.status === "PUBLISHED" ? t("published") : product.status === "DRAFT" ? t("draft") : t("archived")}
        </Badge>
      </div>
      {showCreatedBy && (
        <TruncatedTooltip content={product.createdBy ? (product.createdBy.name || product.createdBy.email) : "-"}>
          <div role="cell" className="truncate text-sm text-muted-foreground">
            {product.createdBy ? (product.createdBy.name || product.createdBy.email) : "-"}
          </div>
        </TruncatedTooltip>
      )}
      {showActions && (
        <div
          role="cell"
          onClick={(e) => {
            // The parent row is a real <a> (see the Link comment above), so
            // stopPropagation alone only keeps this click from reaching
            // *React's* click handling on that anchor - it never runs the
            // Link's own onClick, which is what calls preventDefault to
            // cancel the native "follow href" behavior. Without calling
            // preventDefault ourselves here too, the browser still performs
            // its default action and navigates to the row's view page
            // regardless of which action button was clicked.
            e.preventDefault();
            e.stopPropagation();
          }}
        >
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
    </Link>
  );
}