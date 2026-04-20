"use client";

import { useState, useTransition } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import Image from "next/image";
import { Loader2, Trash2, ChevronDown } from "lucide-react";
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

const STATUS_OPTIONS = [
  { value: "DRAFT", label: "Draft" },
  { value: "PUBLISHED", label: "Published" },
  { value: "ARCHIVED", label: "Archived" },
] as const;

type ProductStatus = (typeof STATUS_OPTIONS)[number]["value"];

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

  const res = await fetch(`/api/admin/products?${params.toString()}`);
  if (!res.ok) throw new Error("Failed to fetch products");
  return res.json();
}

const GRID_COLS = "40px 56px minmax(120px,1fr) 80px 100px";

export function BulkSelectPanel() {
  const queryClient = useQueryClient();
  // search updates after SearchInput's built-in debounce fires
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isChangingStatus, startStatusChange] = useTransition();
  const [isDeleting, startDelete] = useTransition();

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
      {/* Search — outside scroll, matches /orders pattern */}
      <div className="shrink-0">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search products..."
        />
      </div>

      {/* Table — its own scroll zone, never shifts position */}
      <div className="flex-1 min-h-0 flex flex-col rounded-lg border overflow-hidden">

        {/* Toolbar — inside table border so it doesn't push the table down */}
        {selectedCount > 0 && (
          <div className="shrink-0 flex items-center gap-3 border-b bg-background/95 backdrop-blur-sm px-4 py-2.5">
            <span className="text-sm font-medium text-muted-foreground">
              {selectedCount} selected
            </span>
            <div className="h-4 w-px bg-border" />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" disabled={isBusy} className="gap-1.5">
                  Change Status
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

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" disabled={isBusy} className="gap-1.5">
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    Delete {selectedCount} product{selectedCount !== 1 ? "s" : ""}?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete the selected products and their images
                    from S3. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Delete {selectedCount} product{selectedCount !== 1 ? "s" : ""}
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
              Clear selection
            </Button>
          </div>
        )}

        {/* Table header — shrink-0 so it's always visible above the scroll */}
        <div
          role="row"
          className="shrink-0 grid items-center gap-4 border-b p-3 text-sm font-medium text-muted-foreground bg-background"
          style={{ gridTemplateColumns: GRID_COLS }}
        >
          <div role="columnheader">
            <Checkbox
              checked={allSelected ? true : someSelected ? "indeterminate" : false}
              onCheckedChange={toggleAll}
              aria-label="Select all on this page"
            />
          </div>
          <div role="columnheader">Image</div>
          <div role="columnheader">Title</div>
          <div role="columnheader">Price</div>
          <div role="columnheader">Status</div>
        </div>

        {/* Rows — only this part scrolls */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {query.status === "pending" ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading products...
            </div>
          ) : query.status === "error" ? (
            <p className="text-destructive text-sm p-4">Failed to load products.</p>
          ) : allItems.length === 0 ? (
            <p className="text-muted-foreground text-sm p-4">No products found.</p>
          ) : (
            <>
              {allItems.map((product) => {
                const checked = selectedIds.has(product.id);
                const thumb = product.images?.[0]?.url;
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
                        aria-label={`Select ${product.title}`}
                      />
                    </div>
                    <div role="cell">
                      {thumb ? (
                        <div className="relative h-12 w-12 overflow-hidden rounded border bg-muted shrink-0">
                          <Image src={thumb} alt={product.title} fill sizes="48px" className="object-cover" />
                        </div>
                      ) : (
                        <div className="h-12 w-12 rounded border bg-muted shrink-0" />
                      )}
                    </div>
                    <div role="cell" className="min-w-0">
                      <p className="truncate font-medium text-sm">{product.title}</p>
                      {product.brand && (
                        <p className="truncate text-xs text-muted-foreground">{product.brand.name}</p>
                      )}
                    </div>
                    <div role="cell" className="text-sm">${product.price.toFixed(2)}</div>
                    <div role="cell">
                      <Badge variant={getStatusVariant(product.status)}>{product.status}</Badge>
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
                        Loading...
                      </>
                    ) : (
                      "Load more"
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
          Showing {allItems.length} product{allItems.length !== 1 ? "s" : ""}
          {query.hasNextPage ? " (scroll to load more)" : ""}
        </p>
      )}
    </div>
  );
}