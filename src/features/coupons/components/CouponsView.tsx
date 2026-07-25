"use client";

import axios from "axios";
import { useEffect, useRef, useState, useTransition } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useQueryStates } from "nuqs";
import { useQueryClient } from "@tanstack/react-query";
import { Pencil, Copy, Trash2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { TruncatedTooltip } from "@/components/TruncatedTooltip";
import { dateLocale } from "@/lib/i18n/dateLocale";
import { useCurrencyStore } from "@/store/currency";
import { formatPrice, convertCents } from "@/lib/currency";
import { couponSearchParams, type CouponFilters } from "@/lib/query/searchParams";
import {
  useInfiniteVirtualList,
  type InfinitePage,
} from "@/components/infinite/useInfiniteVirtualList";
import { LIST_PAGE_SIZE } from "@/constants/queryConstants";
import { SearchInput } from "@/components/search/SearchInput";
import { SortSelect } from "@/components/search/SortSelect";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { useRouter, usePathname } from "@/i18n/navigation";
import { toast } from "@/components/ui/sonner";
import type { CouponListItem } from "../db/coupons";
import { deleteCouponAction, duplicateCouponAction } from "../actions/coupons";

const ALL = "__all__";
const GRID =
  "grid grid-cols-[minmax(120px,1.2fr)_minmax(90px,0.9fr)_minmax(100px,1fr)_minmax(130px,1.1fr)_minmax(100px,0.9fr)_minmax(110px,1fr)_minmax(90px,0.8fr)_120px] items-center gap-4";

function buildFetcher(f: CouponFilters) {
  return async ({ pageParam }: { pageParam: string | undefined }): Promise<InfinitePage<CouponListItem>> => {
    const params = new URLSearchParams();
    params.set("take", String(LIST_PAGE_SIZE));
    if (pageParam) params.set("cursor", pageParam);
    if (f.search) params.set("search", f.search);
    if (f.status) params.set("status", f.status);
    params.set("sortBy", f.sortBy);
    params.set("sortOrder", f.sortOrder);
    const { data } = await axios.get(`/api/admin/coupons?${params.toString()}`);
    return data;
  };
}

function RowActions({
  id,
  code,
  onEdit,
  onDuplicate,
  onDelete,
  isEditing,
  isDuplicating,
  isDeleting,
}: {
  id: string;
  code: string;
  onEdit: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  isEditing: boolean;
  isDuplicating: boolean;
  isDeleting: boolean;
}) {
  const t = useTranslations("coupons");
  const tc = useTranslations("common");
  const [deleteOpen, setDeleteOpen] = useState(false);

  // Close the confirm dialog once the delete we started actually settles.
  const wasDeleting = useRef(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (wasDeleting.current && !isDeleting) setDeleteOpen(false);
    wasDeleting.current = isDeleting;
  }, [isDeleting]);

  return (
    <div className="flex items-center justify-end gap-1">
      <Button
        size="icon"
        variant="ghost"
        className="h-8 w-8"
        disabled={isEditing}
        title={t("table.edit")}
        onClick={() => onEdit(id)}
      >
        {isEditing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />}
        <span className="sr-only">{t("table.edit")}</span>
      </Button>
      <Button
        size="icon"
        variant="ghost"
        className="h-8 w-8"
        disabled={isDuplicating}
        title={t("table.duplicate")}
        onClick={() => onDuplicate(id)}
      >
        {isDuplicating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
        <span className="sr-only">{t("table.duplicate")}</span>
      </Button>
      <AlertDialog
        open={deleteOpen}
        onOpenChange={(next) => {
          if (isDeleting) return;
          setDeleteOpen(next);
        }}
      >
        <AlertDialogTrigger asChild>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-destructive hover:text-destructive"
            disabled={isDeleting}
          >
            {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            <span className="sr-only">{tc("delete")}</span>
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteConfirm", { code })}</AlertDialogTitle>
            <AlertDialogDescription>{t("deleteDesc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>{tc("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                onDelete(id);
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
                tc("delete")
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Row({
  c,
  editingId,
  deletingId,
  duplicatingId,
  onEdit,
  onDelete,
  onDuplicate,
}: {
  c: CouponListItem;
  editingId: string | null;
  deletingId: string | null;
  duplicatingId: string | null;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
}) {
  const t = useTranslations("coupons");
  const dl = dateLocale(useLocale());
  const { currency, currentRate } = useCurrencyStore();
  const conv = (usd: number) => formatPrice(convertCents(usd, currency, currentRate()), currency);

  return (
    <div role="row" className={cn(GRID, "border-b px-3 py-2.5 text-sm min-w-fit")}>
      <TruncatedTooltip content={c.code}>
        <div className="font-mono font-medium truncate">{c.code}</div>
      </TruncatedTooltip>
      <div>{c.type === "PERCENT" ? `${c.value}%` : conv(c.value)}</div>
      <div className="tabular-nums">
        {c.minOrder != null ? conv(c.minOrder) : t("form.none")}
      </div>
      <div className="tabular-nums whitespace-nowrap">
        {c.usageCount} / {c.usageLimit != null ? c.usageLimit : t("form.unlimited")}
      </div>
      <div className={cn("tabular-nums", c.perUserLimit == null && "text-muted-foreground")}>
        {c.perUserLimit != null ? c.perUserLimit : t("form.unlimited")}
      </div>
      <div className="text-muted-foreground">
        {c.expiresAt
          ? new Date(c.expiresAt).toLocaleDateString(dl, { year: "numeric", month: "short", day: "numeric" })
          : t("form.noExpiry")}
      </div>
      <div>
        <Badge variant={c.active ? "default" : "secondary"}>
          {c.active ? t("table.active") : t("table.inactive")}
        </Badge>
      </div>
      <RowActions
        id={c.id}
        code={c.code}
        onEdit={onEdit}
        onDelete={onDelete}
        onDuplicate={onDuplicate}
        isEditing={editingId === c.id}
        isDeleting={deletingId === c.id}
        isDuplicating={duplicatingId === c.id}
      />
    </div>
  );
}

function SkeletonRow() {
  // Height matches the real row, whose `RowActions` cell holds three h-8 icon
  // buttons - the tallest element in the row.
  return (
    <div role="row" className={cn(GRID, "border-b px-3 py-2.5 min-w-fit")}>
      <Skeleton className="h-3.5 w-24" />
      <Skeleton className="h-3.5 w-12" />
      <Skeleton className="h-3.5 w-16" />
      <Skeleton className="h-3.5 w-10" />
      <Skeleton className="h-3.5 w-8" />
      <Skeleton className="h-3.5 w-20" />
      <Skeleton className="h-5 w-16 rounded-full" />
      <div className="flex items-center justify-end gap-1">
        <Skeleton className="h-8 w-8 rounded-md" />
        <Skeleton className="h-8 w-8 rounded-md" />
        <Skeleton className="h-8 w-8 rounded-md" />
      </div>
    </div>
  );
}

export function CouponsView() {
  const t = useTranslations("coupons");
  const router = useRouter();
  const queryClient = useQueryClient();

  const [params, setParams] = useQueryStates(couponSearchParams, { shallow: false, throttleMs: 300 });
  const f: CouponFilters = {
    search: params.search,
    status: params.status,
    sortBy: params.sortBy,
    sortOrder: params.sortOrder,
  };

  // Per-action pending state, so only the row being acted on spins and the whole
  // table is locked while any action is in flight (mirrors the brands table).
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [, startNavigate] = useTransition();
  const [, startDelete] = useTransition();
  const [, startDuplicate] = useTransition();
  const busy = editingId !== null || deletingId !== null || duplicatingId !== null;

  // Edit navigates away mid-transition and never resets editingId, so on a
  // warm-tree return to this route (e.g. via breadcrumb) the spinner + table
  // lock would stay stuck. Clear every in-flight row state whenever the route
  // settles here. router.refresh() (delete/duplicate) keeps the same pathname,
  // so this never interrupts those.
  const pathname = usePathname();
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEditingId(null);
    setDeletingId(null);
    setDuplicatingId(null);
  }, [pathname]);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["coupons"] });
    router.refresh();
  };

  const handleEdit = (id: string) => {
    setEditingId(id);
    // Locale-aware typed nav; keep the spinner until the route transition ends.
    startNavigate(() => router.push({ pathname: "/admin/coupons/[id]/edit", params: { id } }));
  };

  const handleDelete = (id: string) => {
    setDeletingId(id);
    startDelete(async () => {
      const res = await deleteCouponAction(id);
      if (res && "error" in res) toast.error(res.message);
      else {
        toast.success(t("deleted"));
        refresh();
      }
      setDeletingId(null);
    });
  };

  const handleDuplicate = (id: string) => {
    setDuplicatingId(id);
    startDuplicate(async () => {
      const res = await duplicateCouponAction(id);
      if ("error" in res) toast.error(res.message);
      else {
        toast.success(t("duplicated"));
        refresh();
      }
      setDuplicatingId(null);
    });
  };

  const { parentRef, virtualizer, items, query, isSentinelIndex, isPlaceholderData } =
    useInfiniteVirtualList<CouponListItem>({
      queryKey: ["coupons", f],
      queryFn: buildFetcher(f),
      estimateSize: 49,
      // Create/update redirect back here from the edit page after a server
      // revalidatePath, which only busts the Next cache - the React Query cache
      // stays "fresh" under the global 60s staleTime and would serve stale rows.
      // Refetch on every mount so edits show immediately on soft-nav back.
      refetchOnMount: "always",
    });

  const Header = (
    <div role="row" className={cn(GRID, "border-b p-3 text-sm font-medium text-muted-foreground shrink-0 bg-background rounded-t-lg sticky top-0 z-10 min-w-fit")}>
      <div role="columnheader">{t("table.code")}</div>
      <div role="columnheader">{t("table.discount")}</div>
      <div role="columnheader">{t("table.minOrder")}</div>
      <div role="columnheader">{t("table.usage")}</div>
      <div role="columnheader">{t("table.perUser")}</div>
      <div role="columnheader">{t("table.expires")}</div>
      <div role="columnheader">{t("table.status")}</div>
      <div role="columnheader" className="text-right pr-2">{t("table.actions")}</div>
    </div>
  );

  const Filters = (
    <div className="flex flex-wrap items-center gap-3 mb-4">
      <SearchInput value={f.search} onChange={(v) => setParams({ search: v })} placeholder={t("searchPlaceholder")} />
      <Select
        value={f.status || ALL}
        onValueChange={(v) => setParams({ status: v === ALL ? "" : (v as "active" | "inactive") })}
      >
        <SelectTrigger className="h-9 min-w-36"><SelectValue placeholder={t("table.status")} /></SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{t("filterAll")}</SelectItem>
          <SelectItem value="active">{t("table.active")}</SelectItem>
          <SelectItem value="inactive">{t("table.inactive")}</SelectItem>
        </SelectContent>
      </Select>
      <SortSelect
        sortBy={f.sortBy}
        sortOrder={f.sortOrder}
        onSortByChange={(v) => setParams({ sortBy: v as "createdAt" | "code" })}
        onSortOrderChange={(o) => setParams({ sortOrder: o })}
        options={[
          { value: "createdAt", label: t("sortCreated") },
          { value: "code", label: t("table.code") },
        ]}
      />
    </div>
  );

  // Lock the whole table while any row action is in flight so a second action
  // can't be started elsewhere (and the placeholder fade during a filter swap).
  const blocked = busy || isPlaceholderData;
  const blockClass = blocked && "opacity-50 pointer-events-none transition-opacity duration-150";

  let body: React.ReactNode;
  if (query.status === "error") {
    body = (
      <Alert variant="destructive">
        <AlertTitle>{t("title")}</AlertTitle>
        <AlertDescription>{query.error.message}</AlertDescription>
      </Alert>
    );
  } else if (query.status === "pending") {
    body = (
      <div role="table" className="rounded-lg border flex-1 min-h-0 overflow-auto [scrollbar-gutter:stable]">
        {Header}
        {Array.from({ length: 10 }).map((_, i) => <SkeletonRow key={i} />)}
      </div>
    );
  } else if (items.length === 0) {
    const hasFilters = !!f.search || !!f.status;
    body = (
      <p className="text-sm text-muted-foreground py-10 text-center">
        {hasFilters ? t("noResults") : t("empty")}
      </p>
    );
  } else if (!query.hasNextPage) {
    body = (
      <div role="table" className={cn("rounded-lg border flex-1 min-h-0 overflow-auto [scrollbar-gutter:stable]", blockClass)}>
        {Header}
        {items.map((c) => (
          <Row
            key={c.id}
            c={c}
            editingId={editingId}
            deletingId={deletingId}
            duplicatingId={duplicatingId}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onDuplicate={handleDuplicate}
          />
        ))}
      </div>
    );
  } else {
    body = (
      <div role="table" ref={parentRef} className={cn("rounded-lg border flex-1 min-h-0 overflow-auto [scrollbar-gutter:stable]", blockClass)}>
        {Header}
        <div style={{ height: virtualizer.getTotalSize(), position: "relative", width: "100%" }}>
          {virtualizer.getVirtualItems().map((vRow) => {
            const sentinel = isSentinelIndex(vRow.index);
            const c = sentinel ? null : items[vRow.index];
            return (
              <div
                key={sentinel ? "sentinel" : c!.id}
                ref={virtualizer.measureElement}
                data-index={vRow.index}
                style={{ position: "absolute", top: 0, left: 0, width: "100%", transform: `translateY(${vRow.start}px)` }}
              >
                {sentinel ? (
                  <SkeletonRow />
                ) : (
                  <Row
                    c={c!}
                    editingId={editingId}
                    deletingId={deletingId}
                    duplicatingId={duplicatingId}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onDuplicate={handleDuplicate}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {Filters}
      {body}
    </div>
  );
}
