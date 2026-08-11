"use client";

import axios from "axios";
import { useEffect, useRef, useState, useTransition } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useQueryStates } from "nuqs";
import { useQueryClient } from "@tanstack/react-query";
import { Check, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { dateLocale } from "@/lib/i18n/dateLocale";
import { reviewSearchParams, type ReviewFilters } from "@/lib/query/searchParams";
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
import { Textarea } from "@/components/ui/textarea";
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
import { useRouter } from "@/i18n/navigation";
import { toast } from "@/components/ui/sonner";
import { getProductTitle } from "@/features/products/utils/translations";
import type { ReviewStatus } from "@/generated/prisma/client";
import type { AdminReviewItem } from "../db/adminQueries";
import { StarRating } from "./StarRating";
import { moderateReviewAction } from "../actions/reviews";

const ALL = "__all__";
const GRID =
  "grid grid-cols-[minmax(140px,1.3fr)_minmax(110px,1fr)_110px_minmax(180px,2fr)_110px_140px_110px] items-center gap-4";

function buildFetcher(f: ReviewFilters) {
  return async ({ pageParam }: { pageParam: string | undefined }): Promise<InfinitePage<AdminReviewItem>> => {
    const params = new URLSearchParams();
    params.set("take", String(LIST_PAGE_SIZE));
    if (pageParam) params.set("cursor", pageParam);
    if (f.search) params.set("search", f.search);
    if (f.status) params.set("status", f.status);
    params.set("sortOrder", f.sortOrder);
    const { data } = await axios.get(`/api/admin/reviews?${params.toString()}`);
    return data;
  };
}

function StatusBadge({ status }: { status: ReviewStatus }) {
  const t = useTranslations("admin.reviews");
  if (status === "APPROVED") return <Badge variant="default">{t("status.approved")}</Badge>;
  if (status === "REJECTED") return <Badge variant="destructive">{t("status.rejected")}</Badge>;
  return <Badge variant="secondary">{t("status.pending")}</Badge>;
}

function RowActions({
  review,
  onApprove,
  onReject,
  isApproving,
  isRejecting,
}: {
  review: AdminReviewItem;
  onApprove: (id: string) => void;
  onReject: (id: string, reason: string) => void;
  isApproving: boolean;
  isRejecting: boolean;
}) {
  const t = useTranslations("admin.reviews");
  const tc = useTranslations("common");
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState("");

  // Close the reject dialog once the action settles.
  const wasRejecting = useRef(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (wasRejecting.current && !isRejecting) setRejectOpen(false);
    wasRejecting.current = isRejecting;
  }, [isRejecting]);

  const busy = isApproving || isRejecting;

  // Fixed two-slot layout so the Approve / Reject icons stay column-aligned
  // across rows regardless of which action a given status exposes (an
  // already-approved row hides Approve, a rejected row hides Reject).
  return (
    <div className="flex items-center justify-end gap-1">
      {review.status !== "APPROVED" ? (
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 text-emerald-600 hover:text-emerald-600"
          disabled={busy}
          title={t("approve")}
          onClick={() => onApprove(review.id)}
        >
          {isApproving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          <span className="sr-only">{t("approve")}</span>
        </Button>
      ) : (
        <span className="h-8 w-8" aria-hidden />
      )}
      {/* Reject only acts on content: a rating with no comment has nothing to
          moderate, so suppressing it would be rating manipulation, not
          moderation. Such rows are read-only here. */}
      {review.status !== "REJECTED" && !!review.comment ? (
        <AlertDialog
          open={rejectOpen}
          onOpenChange={(next) => {
            if (isRejecting) return;
            setRejectOpen(next);
            if (next) setReason("");
          }}
        >
          <AlertDialogTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-destructive hover:text-destructive"
              disabled={busy}
              title={t("reject")}
            >
              {isRejecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
              <span className="sr-only">{t("reject")}</span>
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("rejectConfirm")}</AlertDialogTitle>
              <AlertDialogDescription>{t("rejectDesc")}</AlertDialogDescription>
            </AlertDialogHeader>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t("reasonPlaceholder")}
              rows={3}
              maxLength={500}
              disabled={isRejecting}
            />
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isRejecting}>{tc("cancel")}</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  onReject(review.id, reason);
                }}
                disabled={isRejecting}
                variant="destructiveSolid"
              >
                {isRejecting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t("rejecting")}
                  </>
                ) : (
                  t("reject")
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : (
        <span className="h-8 w-8" aria-hidden />
      )}
    </div>
  );
}

function Row({
  r,
  locale,
  dl,
  approvingId,
  rejectingId,
  onApprove,
  onReject,
}: {
  r: AdminReviewItem;
  locale: string;
  dl: string;
  approvingId: string | null;
  rejectingId: string | null;
  onApprove: (id: string) => void;
  onReject: (id: string, reason: string) => void;
}) {
  const t = useTranslations("admin.reviews");
  const productName = getProductTitle(r.product, locale) || t("deletedProduct");

  return (
    <div role="row" className={cn(GRID, "border-b px-3 py-2.5 text-sm min-w-fit")}>
      <div className="truncate font-medium" title={productName}>{productName}</div>
      <div className="truncate text-muted-foreground" title={r.user.email ?? undefined}>
        {r.user.name ?? r.user.email ?? t("anonymous")}
      </div>
      <div><StarRating rating={r.rating} size={14} /></div>
      <div className="text-muted-foreground line-clamp-2" title={r.comment ?? undefined}>
        {r.comment || <span className="italic">{t("noComment")}</span>}
      </div>
      <div className="flex justify-center"><StatusBadge status={r.status} /></div>
      <div className="text-xs text-muted-foreground whitespace-nowrap">
        {new Date(r.createdAt).toLocaleDateString(dl, { year: "numeric", month: "short", day: "numeric" })}
      </div>
      <RowActions
        review={r}
        onApprove={onApprove}
        onReject={onReject}
        isApproving={approvingId === r.id}
        isRejecting={rejectingId === r.id}
      />
    </div>
  );
}

function SkeletonRow() {
  // Height matches the real row, whose `RowActions` cell holds two h-8 icon
  // buttons (approve / reject) - the tallest element in the row.
  return (
    <div role="row" className={cn(GRID, "border-b px-3 py-2.5 min-w-fit")}>
      <Skeleton className="h-3.5 w-32" />
      <Skeleton className="h-3.5 w-24" />
      <Skeleton className="h-3.5 w-20" />
      <Skeleton className="h-3.5 w-40" />
      <Skeleton className="h-5 w-16 rounded-full mx-auto" />
      <Skeleton className="h-3.5 w-20" />
      <div className="flex items-center justify-end gap-1">
        <Skeleton className="h-8 w-8 rounded-md" />
        <Skeleton className="h-8 w-8 rounded-md" />
      </div>
    </div>
  );
}

export function ReviewsView({ counts }: { counts: Record<ReviewStatus, number> }) {
  const t = useTranslations("admin.reviews");
  const dl = dateLocale(useLocale());
  const locale = useLocale();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [params, setParams] = useQueryStates(reviewSearchParams, { shallow: false, throttleMs: 300 });
  const f: ReviewFilters = {
    search: params.search,
    status: params.status,
    sortOrder: params.sortOrder,
  };

  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [, startApprove] = useTransition();
  const [, startReject] = useTransition();
  const busy = approvingId !== null || rejectingId !== null;

  // Await the list refetch before clearing the row's pending state, so the row
  // either disappears (it left the current status filter) or updates in one go -
  // never flashing its idle icon back in the gap between the mutation resolving
  // and the new data arriving.
  const refresh = async () => {
    router.refresh();
    await queryClient.invalidateQueries({ queryKey: ["admin-reviews"] });
  };

  const handleApprove = (id: string) => {
    setApprovingId(id);
    startApprove(async () => {
      const res = await moderateReviewAction({ reviewId: id, status: "APPROVED", reason: undefined });
      if ("error" in res) {
        toast.error(res.message);
      } else {
        await refresh();
        toast.success(t("approved"));
      }
      setApprovingId(null);
    });
  };

  const handleReject = (id: string, reason: string) => {
    setRejectingId(id);
    startReject(async () => {
      const res = await moderateReviewAction({ reviewId: id, status: "REJECTED", reason });
      if ("error" in res) {
        toast.error(res.message);
      } else {
        await refresh();
        toast.success(t("rejected"));
      }
      setRejectingId(null);
    });
  };

  const { parentRef, virtualizer, items, query, isSentinelIndex, isPlaceholderData } =
    useInfiniteVirtualList<AdminReviewItem>({
      queryKey: ["admin-reviews", f],
      queryFn: buildFetcher(f),
      estimateSize: 53,
      // Moderation mutations revalidate the server page but the React Query cache
      // stays "fresh" under the global staleTime - refetch on mount so a soft-nav
      // back shows the current queue, and on window focus so returning to this
      // tab surfaces reviews submitted elsewhere without a manual navigation.
      refetchOnMount: "always",
      refetchOnWindowFocus: true,
    });

  const statusLabel = (s: "PENDING" | "APPROVED" | "REJECTED") =>
    `${t(`status.${s.toLowerCase()}` as Parameters<typeof t>[0])} (${counts[s]})`;

  const Header = (
    <div role="row" className={cn(GRID, "border-b p-3 text-sm font-medium text-muted-foreground shrink-0 bg-background rounded-t-lg sticky top-0 z-10 min-w-fit")}>
      <div role="columnheader">{t("colProduct")}</div>
      <div role="columnheader">{t("colAuthor")}</div>
      <div role="columnheader">{t("colRating")}</div>
      <div role="columnheader">{t("colComment")}</div>
      <div role="columnheader" className="text-center">{t("colStatus")}</div>
      <div role="columnheader">{t("colDate")}</div>
      <div role="columnheader" className="text-right pr-2">{t("colActions")}</div>
    </div>
  );

  const selectedStatusLabel = f.status ? statusLabel(f.status) : t("allStatuses");

  const Filters = (
    <div className="flex flex-wrap items-center gap-3 mb-4">
      <SearchInput
        value={f.search}
        onChange={(v) => setParams({ search: v })}
        placeholder={t("searchPlaceholder")}
        className="min-w-40"
      />
      <Select
        value={f.status || ALL}
        onValueChange={(v) => setParams({ status: v === ALL ? "" : (v as ReviewFilters["status"]) })}
      >
        <SelectTrigger className="h-9 min-w-0 max-w-[45vw] sm:max-w-none sm:min-w-44">
          <SelectValue placeholder={t("colStatus")}>
            <span className="truncate">{selectedStatusLabel}</span>
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{t("allStatuses")}</SelectItem>
          <SelectItem value="PENDING">{statusLabel("PENDING")}</SelectItem>
          <SelectItem value="APPROVED">{statusLabel("APPROVED")}</SelectItem>
          <SelectItem value="REJECTED">{statusLabel("REJECTED")}</SelectItem>
        </SelectContent>
      </Select>
      <SortSelect
        sortBy="createdAt"
        sortOrder={f.sortOrder}
        onSortByChange={() => {}}
        onSortOrderChange={(o) => setParams({ sortOrder: o })}
        options={[{ value: "createdAt", label: t("colDate") }]}
        triggerClassName="max-w-[45vw] sm:max-w-none"
      />
    </div>
  );

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
        {items.map((r) => (
          <Row key={r.id} r={r} locale={locale} dl={dl} approvingId={approvingId} rejectingId={rejectingId} onApprove={handleApprove} onReject={handleReject} />
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
            const r = sentinel ? null : items[vRow.index];
            return (
              <div
                key={sentinel ? "sentinel" : r!.id}
                ref={virtualizer.measureElement}
                data-index={vRow.index}
                style={{ position: "absolute", top: 0, left: 0, width: "100%", transform: `translateY(${vRow.start}px)` }}
              >
                {sentinel ? (
                  <SkeletonRow />
                ) : (
                  <Row r={r!} locale={locale} dl={dl} approvingId={approvingId} rejectingId={rejectingId} onApprove={handleApprove} onReject={handleReject} />
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
