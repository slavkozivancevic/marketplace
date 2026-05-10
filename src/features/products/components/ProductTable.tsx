"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import Image from "next/image";
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
import { deleteProduct, duplicateProduct } from "@/features/products/actions/products";
import { SerializedProductListItem } from "@/types/types";
import { useCurrencyStore } from "@/store/currency";
import { formatPrice, convertCents } from "@/lib/currency";

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
      <div role="columnheader" className="truncate">{t("price")}</div>
      <div role="columnheader" className="truncate">{t("status")}</div>
      {showActions && <div role="columnheader" className="truncate">{t("actions")}</div>}
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
}: {
  product: SerializedProductListItem;
  showActions?: boolean;
  basePath?: string;
}) {
  const t = useTranslations("products");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isDeleting, startDelete] = useTransition();
  const [isDuplicating, startDuplicate] = useTransition();
  const { currency, currentRate } = useCurrencyStore();
  const [thumbLoaded, setThumbLoaded] = useState(false);

  const handleDelete = () => {
    startDelete(async () => {
      const result = await deleteProduct(product.id, basePath);
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
          onClick: () => router.push(`${basePath}/${copyId}/edit`),
        },
      });
    });
  };

  const thumbnailUrl = product.images?.[0]?.url;
  const cols = showActions ? COLS_ACTIONS : COLS_BASE;
  const isBusy = isDeleting || isDuplicating;

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
      onClick={() => !isBusy && router.push(`${basePath}/${product.id}`)}
    >
      <div role="cell">
        {thumbnailUrl ? (
          <div className="relative h-12 w-12 overflow-hidden rounded border bg-muted">
            {!thumbLoaded && <div className="absolute inset-0 z-10 skeleton-shimmer" />}
            <Image
              src={thumbnailUrl}
              alt={product.title}
              fill
              sizes="48px"
              className="object-cover"
              onLoad={() => setThumbLoaded(true)}
            />
          </div>
        ) : (
          <div className="h-12 w-12 rounded border bg-muted flex flex-col items-center justify-center gap-0.5">
            <ImageOff className="h-4 w-4 text-muted-foreground/40" />
            <span className="text-[8px] text-muted-foreground/40">{t("noImage")}</span>
          </div>
        )}
      </div>
      <div role="cell" className="truncate">{product.title}</div>
      <div role="cell">
        {product.brand ? (
          <div className="flex items-center gap-1.5 min-w-0">
            {product.brand.logoUrl && (
              <div className="relative h-5 w-5 shrink-0 overflow-hidden rounded-sm border bg-muted">
                <Image
                  src={product.brand.logoUrl}
                  alt={product.brand.name}
                  fill
                  sizes="20px"
                  className="object-contain"
                />
              </div>
            )}
            <span className="truncate text-sm">{product.brand.name}</span>
          </div>
        ) : (
          <span className="text-muted-foreground text-sm">—</span>
        )}
      </div>
      <div role="cell" className="truncate text-muted-foreground">
        {product.description}
      </div>
      <div role="cell">{formatPrice(convertCents(product.price, currency, currentRate()), currency)}</div>
      <div role="cell">
        <Badge variant={getStatusVariant(product.status)}>
          {product.status === "PUBLISHED" ? t("published") : product.status === "DRAFT" ? t("draft") : t("archived")}
        </Badge>
      </div>
      {showActions && (
        <div role="cell" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" asChild>
              <Link href={`${basePath}/${product.id}/edit`}>
                <Pencil className="h-4 w-4" />
                <span className="sr-only">{tCommon("edit")}</span>
              </Link>
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
            <AlertDialog>
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
                  <AlertDialogTitle>{t("deleteConfirm", { title: product.title })}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {t("cannotUndo")}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{tCommon("cancel")}</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {tCommon("delete")}
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