"use client";
import axios from "axios";

import { useEffect, useRef, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { getProductTitle } from "@/features/products/utils/translations";
import { getBrandName } from "@/features/brands/utils/translations";
import { useInfiniteQuery } from "@tanstack/react-query";
import { RetryImage } from "@/components/RetryImage";
import { ImageOff, Loader2, Trash2, ChevronDown } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { SearchInput } from "@/components/search/SearchInput";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { cn } from "@/lib/utils";
import { bulkUpdateProductStatus, bulkDeleteProducts } from "@/features/products/actions/products";
import { SerializedProductListItem } from "@/types/types";
import { LIST_PAGE_SIZE } from "@/constants/queryConstants";
import type { InfinitePage } from "@/components/infinite/useInfiniteVirtualList";
import { useCurrencyStore } from "@/store/currency";
import { formatPrice, convertCents } from "@/lib/currency";

type ProductStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

function getStatusVariant(status: string) {
  if (status === "PUBLISHED") return "default" as const;
  if (status === "DRAFT") return "secondary" as const;
  return "destructive" as const;
}

async function fetchPage({
  pageParam,
  search,
}: {
  pageParam: string | undefined;
  search: string;
}): Promise<InfinitePage<SerializedProductListItem>> {
  const params = new URLSearchParams();
  params.set("take", String(LIST_PAGE_SIZE));
  if (pageParam) params.set("cursor", pageParam);
  if (search) params.set("search", search);
  params.set("sortBy", "createdAt");
  params.set("sortOrder", "desc");

  const { data } = await axios.get(`/api/admin/products?${params.toString()}`);
  return data;
}

const GRID_COLS = "40px 56px minmax(120px,1fr) 80px 100px";

export function BulkSelectPanel() {
  const t = useTranslations("bulkProducts");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const queryClient = useQueryClient();
  const { currency, currentRate } = useCurrencyStore();

  const STATUS_OPTIONS: { value: ProductStatus; label: string }[] = [
    { value: "DRAFT", label: t("draft") },
    { value: "PUBLISHED", label: t("published") },
    { value: "ARCHIVED", label: t("archived") },
  ];
  // search updates after SearchInput's built-in debounce fires
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isChangingStatus, startStatusChange] = useTransition();
  const [isDeleting, startDelete] = useTransition();
  const [deleteOpen, setDeleteOpen] = useState(false);

  const wasDeleting = useRef(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (wasDeleting.current && !isDeleting) setDeleteOpen(false);
    wasDeleting.current = isDeleting;
  }, [isDeleting]);

  const query = useInfiniteQuery({
    queryKey: ["products", "admin", "bulk", search],
    queryFn: ({ pageParam }) =>
      fetchPage({ pageParam: pageParam as string | undefined, search }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor,
  });

  const allItems: SerializedProductListItem[] =
    query.data?.pages.flatMap((p) => p.items) ?? [];

  const allPageIds = allItems.map((p) => p.id);
  const allSelected =
    allPageIds.length > 0 && allPageIds.every((id) => selectedIds.has(id));
  const someSelected = allPageIds.some((id) => selectedIds.has(id));

  const toggleAll = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        allPageIds.forEach((id) => next.delete(id));
      } else {
        allPageIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const toggleOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const invalidateAndClear = () => {
    queryClient.invalidateQueries({ queryKey: ["products"] });
    setSelectedIds(new Set());
  };

  const handleChangeStatus = (status: ProductStatus) => {
    const ids = Array.from(selectedIds);
    startStatusChange(async () => {
      const result = await bulkUpdateProductStatus(ids, status);
      if (result.error) {
        toast.error(result.message);
      } else {
        toast.success(result.message);
        invalidateAndClear();
      }
    });
  };

  const handleDelete = () => {
    const ids = Array.from(selectedIds);
    startDelete(async () => {
      const result = await bulkDeleteProducts(ids);
      if (result.error) {
        toast.error(result.message);
      } else {
        toast.success(result.message);
        invalidateAndClear();
      }
    });
  };

  const selectedCount = selectedIds.size;
  const isBusy = isChangingStatus || isDeleting;

  return (
    <div className="flex-1 flex flex-col min-h-0 gap-3">
      {/* Search - outside scroll, matches /orders pattern */}
      <div className="shrink-0">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder={t("searchPlaceholder")}
        />
      </div>

      {/* Table - its own scroll zone, never shifts position */}
      <div className="flex-1 min-h-0 flex flex-col rounded-lg border overflow-hidden">

        {/* Toolbar - inside table border so it doesn't push the table down */}
        {selectedCount > 0 && (
          <div className="shrink-0 flex items-center gap-3 border-b bg-background/95 backdrop-blur-xs px-4 py-2.5">
            <span className="text-sm font-medium text-muted-foreground">
              {t("selected", { count: selectedCount })}
            </span>
            <div className="h-4 w-px bg-border" />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" disabled={isBusy} className="gap-1.5">
                  {t("changeStatus")}
                  <ChevronDown className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {STATUS_OPTIONS.map((opt) => (
                  <DropdownMenuItem
                    key={opt.value}
                    onSelect={() => handleChangeStatus(opt.value)}
                  >
                    {opt.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <AlertDialog
              open={deleteOpen}
              onOpenChange={(next) => {
                if (isDeleting) return;
                setDeleteOpen(next);
              }}
            >
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" disabled={isBusy} className="gap-1.5">
                  <Trash2 className="h-3.5 w-3.5" />
                  {t("delete")}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    {t("deleteConfirm", { count: selectedCount })}
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    {t("deleteDesc")}
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
                        {tCommon("deleting")}
                      </>
                    ) : (
                      t("deleteAction", { count: selectedCount })
                    )}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedIds(new Set())}
              className="ml-auto"
            >
              {t("clearSelection")}
            </Button>
          </div>
        )}

        {/* Rows + header in a single scroll zone. Keeping the header INSIDE
            the overflow container (with `sticky top-0`) is what makes the
            column edges line up: when rows overflow vertically the scrollbar
            takes ~15px on the right, so a header rendered *outside* the
            scroll would be ~15px wider than the rows and the right-most
            column (Status) would visibly drift relative to the cells. */}
        <div className="flex-1 min-h-0 overflow-auto [scrollbar-gutter:stable]">
          <div
            role="row"
            className="sticky top-0 z-10 grid items-center gap-4 border-b p-3 text-sm font-medium text-muted-foreground bg-background min-w-fit"
            style={{ gridTemplateColumns: GRID_COLS }}
          >
            <div role="columnheader">
              <Checkbox
                checked={allSelected ? true : someSelected ? "indeterminate" : false}
                onCheckedChange={toggleAll}
                aria-label="Select all on this page"
              />
            </div>
            <div role="columnheader">{t("colImage")}</div>
            <div role="columnheader">{t("colTitle")}</div>
            <div role="columnheader" className="text-right">{t("colPrice")}</div>
            <div role="columnheader" className="text-center">{t("colStatus")}</div>
          </div>

          {query.status === "pending" ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t("loading")}
            </div>
          ) : query.status === "error" ? (
            <p className="text-destructive text-sm p-4">{t("error")}</p>
          ) : allItems.length === 0 ? (
            <p className="text-muted-foreground text-sm p-4">{t("noProducts")}</p>
          ) : (
            <>
              {allItems.map((product) => {
                const checked = selectedIds.has(product.id);
                const firstMedia = product.media?.[0];
                const thumb = firstMedia?.thumbUrl ?? firstMedia?.url;
                const title = getProductTitle(product, locale);
                const brandName = product.brand ? getBrandName(product.brand, locale) : "";
                return (
                  <div
                    key={product.id}
                    role="row"
                    className={cn(
                      "grid items-center gap-4 border-b p-3 transition-colors cursor-pointer hover:bg-muted/50",
                      checked && "bg-primary/5",
                    )}
                    style={{ gridTemplateColumns: GRID_COLS }}
                    onClick={() => toggleOne(product.id)}
                  >
                    <div role="cell" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => toggleOne(product.id)}
                        aria-label={`Select ${title}`}
                      />
                    </div>
                    <div role="cell">
                      {thumb ? (
                        <div className="relative h-12 w-12 overflow-hidden rounded border bg-muted shrink-0">
                          <RetryImage src={thumb} alt={title} fill sizes="48px" className="object-cover" />
                        </div>
                      ) : (
                        <div className="h-12 w-12 rounded border bg-muted shrink-0 flex flex-col items-center justify-center gap-0.5">
                          <ImageOff className="h-4 w-4 text-muted-foreground/40" />
                          <span className="text-[8px] text-muted-foreground/40">{t("noImage")}</span>
                        </div>
                      )}
                    </div>
                    <div role="cell" className="min-w-0">
                      <p className="truncate font-medium text-sm">{title}</p>
                      {brandName && (
                        <p className="truncate text-xs text-muted-foreground">{brandName}</p>
                      )}
                    </div>
                    <div role="cell" className="text-sm text-right tabular-nums">
                      {formatPrice(convertCents(product.price, currency, currentRate()), currency)}
                    </div>
                    <div role="cell" className="flex justify-center">
                      <Badge variant={getStatusVariant(product.status)}>
                        {t(product.status.toLowerCase() as "draft" | "published" | "archived")}
                      </Badge>
                    </div>
                  </div>
                );
              })}

              {query.hasNextPage && (
                <div className="p-4 flex justify-center border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => query.fetchNextPage()}
                    disabled={query.isFetchingNextPage}
                  >
                    {query.isFetchingNextPage ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                        {t("loadingMore")}
                      </>
                    ) : (
                      t("loadMore")
                    )}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {allItems.length > 0 && (
        <p className="shrink-0 text-xs text-muted-foreground text-right">
          {t("showing", { count: allItems.length })}
          {query.hasNextPage ? ` ${t("scrollMore")}` : ""}
        </p>
      )}
    </div>
  );
}