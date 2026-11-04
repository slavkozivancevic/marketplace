"use client";

import { useState } from "react";
import axios from "axios";
import { useTranslations, useLocale } from "next-intl";
import { useQueryStates } from "nuqs";
import { cn } from "@/lib/utils";
import { dateLocale } from "@/lib/i18n/dateLocale";
import { auditSearchParams, type AuditFilters } from "@/lib/query/searchParams";
import {
  useInfiniteVirtualList,
  type InfinitePage,
} from "@/components/infinite/useInfiniteVirtualList";
import { LIST_PAGE_SIZE } from "@/constants/queryConstants";
import { SearchInput } from "@/components/search/SearchInput";
import { SortSelect } from "@/components/search/SortSelect";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { TruncatedTooltip } from "@/components/TruncatedTooltip";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { AuditLogItem } from "../db/queries";
import {
  AUDIT_COLUMN_KEYS,
  AUDIT_FIELD_KEYS,
  AUDIT_VALUE_KEYS,
  renderAuditDiff,
  type AuditDiffLabels,
} from "../auditDiff";
// Grid template + row placeholder are owned by the skeleton module so the real
// table and its loading state can never describe different columns.
import { AUDIT_COLS as GRID, AuditSkeletonRow as SkeletonRow } from "./AuditTableSkeleton";
import { TableScroll } from "@/components/ui/table-scroll";

// Radix Select can't use an empty-string item value, so "all" is the sentinel.
const ALL = "__all__";

// Action keys we emit and have localized labels for. Unknown (future) keys fall
// back to the raw identifier so the table never breaks on a missing translation.
const KNOWN_ACTIONS = new Set([
  "order.shipped", "order.delivered", "order.cod_paid", "order.cancelled",
  "order.refunded", "order.partially_refunded", "payout.released",
  "return.requested", "return.approved", "return.rejected", "return.shipped", "return.refunded",
  "user.role_changed", "member.role_changed", "member.removed",
  "member.invite_accepted", "member.invite_declined", "member.invite_revoked",
  "organization.verified_changed", "organization.policy_changed",
  "product.created", "product.updated", "product.deleted", "product.duplicated",
  "product.published", "product.unpublished", "product.archived", "product.unarchived",
  "product.rolled_back", "product.bulk_status", "product.bulk_deleted", "product.bulk_created",
  "product.bulk_updated",
  "brand.created", "brand.updated", "brand.deleted", "brand.duplicated",
  "category.created", "category.updated", "category.deleted", "category.duplicated",
  "attribute.created", "attribute.updated", "attribute.deleted", "attribute.duplicated",
  "coupon.created", "coupon.updated", "coupon.deleted", "coupon.duplicated",
  "review.approved", "review.rejected",
  "cod_balance.settled", "cod_balance.credit_paid",
  "payout.reversed", "payout.reversal_failed",
  "organization.member_removed", "organization.owner_promoted", "organization.catalog_deactivated",
  "organization.org_deleted",
  "tag.created", "tag.updated", "tag.deleted", "tag.duplicated",
  "trust_point.created", "trust_point.updated", "trust_point.deleted",
  "trust_point.duplicated",
  "priceRule.created", "priceRule.updated", "priceRule.deleted", "priceRule.duplicated",
  "price_market.created", "price_market.updated", "price_market.deleted",
  "price_market.duplicated",
]);

type Labels = {
  entity: (type: string) => string;
  /** Field, column and value words plus the reader's locale, for the details column. */
  diff: AuditDiffLabels;
  action: (a: string) => string;
  bulk: string;
  system: string;
};

function buildFetcher(f: AuditFilters) {
  return async ({
    pageParam,
  }: {
    pageParam: string | undefined;
  }): Promise<InfinitePage<AuditLogItem>> => {
    const params = new URLSearchParams();
    params.set("take", String(LIST_PAGE_SIZE));
    if (pageParam) params.set("cursor", pageParam);
    if (f.search) params.set("search", f.search);
    if (f.action) params.set("action", f.action);
    if (f.entityType) params.set("entityType", f.entityType);
    if (f.sortOrder) params.set("sortOrder", f.sortOrder);
    if (f.dateFrom) params.set("dateFrom", f.dateFrom);
    if (f.dateTo) params.set("dateTo", f.dateTo);
    const { data } = await axios.get(`/api/admin/audit?${params.toString()}`);
    return data;
  };
}

function Row({ row, dl, labels }: { row: AuditLogItem; dl: string; labels: Labels }) {
  const diff = renderAuditDiff(row.diff, labels.diff);
  const isBulk = row.entityId === "bulk";
  return (
    <div role="row" className={cn(GRID, "items-start border-b px-3 py-2.5 text-sm min-w-fit")}>
      <div className="text-muted-foreground text-xs whitespace-nowrap">
        {new Date(row.createdAt).toLocaleDateString(dl, {
          year: "numeric", month: "short", day: "numeric",
        })}
      </div>
      <div className="text-muted-foreground text-xs whitespace-nowrap">
        {new Date(row.createdAt).toLocaleTimeString(dl, {
          hour: "2-digit", minute: "2-digit",
        })}
      </div>
      {row.actorEmail ? (
        <TruncatedTooltip content={row.actorEmail}>
          <div className="truncate">{row.actorEmail}</div>
        </TruncatedTooltip>
      ) : (
        <div className="text-muted-foreground italic">{labels.system}</div>
      )}
      <div>
        <Badge variant="secondary" className="text-[11px]" title={row.action}>
          {labels.action(row.action)}
        </Badge>
      </div>
      <div className="whitespace-nowrap text-xs">
        <span>{labels.entity(row.entityType)}</span>{" "}
        {isBulk ? (
          <span className="text-muted-foreground">· {labels.bulk}</span>
        ) : (
          <span className="font-mono text-muted-foreground">#{row.entityId.slice(-8)}</span>
        )}
      </div>
      <TruncatedTooltip content={diff ?? "-"}>
        <div className="text-xs text-muted-foreground line-clamp-2">{diff ?? "-"}</div>
      </TruncatedTooltip>
    </div>
  );
}

export function AuditLogView({
  facets,
}: {
  facets: { actions: string[]; entityTypes: string[] };
}) {
  const t = useTranslations("admin.audit");
  const locale = useLocale();
  const dl = dateLocale(locale);

  // Localized labels for entity types and diff field keys (action keys stay as
  // stable technical identifiers, like Stripe/AWS audit logs).
  const entityLabels: Record<string, string> = {
    Order: t("entities.order"),
    Product: t("entities.product"),
    Brand: t("entities.brand"),
    Category: t("entities.category"),
    Attribute: t("entities.attribute"),
    Return: t("entities.return"),
    User: t("entities.user"),
    Membership: t("entities.membership"),
    Invite: t("entities.invite"),
    Organization: t("entities.organization"),
    Coupon: t("entities.coupon"),
    Review: t("entities.review"),
    Tag: t("entities.tag"),
    TrustPoint: t("entities.trustPoint"),
    PriceRule: t("entities.priceRule"),
    PriceMarket: t("entities.priceMarket"),
  };
  // Every key, column and value the log can show has a label (auditDiff.ts
  // lists them; its test fails on a writer's key that is missing).
  type Key = Parameters<typeof t>[0];
  const fieldLabels = Object.fromEntries(AUDIT_FIELD_KEYS.map((k) => [k, t(`fields.${k}` as Key)]));
  const columnLabels = Object.fromEntries(AUDIT_COLUMN_KEYS.map((k) => [k, t(`columns.${k}` as Key)]));
  const valueLabels = Object.fromEntries(AUDIT_VALUE_KEYS.map((k) => [k, t(`values.${k}` as Key)]));
  const labels: Labels = {
    entity: (type) => entityLabels[type] ?? type,
    diff: {
      field: (key) => fieldLabels[key] ?? key,
      column: (key) => columnLabels[key],
      value: (code) => valueLabels[code],
      locale,
    },
    action: (a) => (KNOWN_ACTIONS.has(a) ? t(`actions.${a}` as Parameters<typeof t>[0]) : a),
    bulk: t("bulk"),
    system: t("system"),
  };

  const [params, setParams] = useQueryStates(auditSearchParams, {
    shallow: false,
    throttleMs: 300,
  });
  const f: AuditFilters = {
    search: params.search,
    action: params.action,
    entityType: params.entityType,
    sortOrder: params.sortOrder,
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
  };

  // Action/entity-type filter changes snap the scroll back to the top - see
  // resetScrollKey on useInfiniteVirtualList. Search and sort are left alone
  // (same scope as every other filtered list in the app).
  const [scrollResetToken, setScrollResetToken] = useState(0);
  const resetListScroll = () => setScrollResetToken((n) => n + 1);

  const { parentRef, virtualizer, items, query, isSentinelIndex, isPlaceholderData } =
    useInfiniteVirtualList<AuditLogItem>({
      queryKey: ["audit", f],
      queryFn: buildFetcher(f),
      estimateSize: 49,
      // Audit rows are written by recordAudit as a side effect of actions across
      // the app, none of which invalidate ["audit"]. Without this, returning to
      // this view within the global 60s staleTime would hide the newest entries.
      // Refetch on every mount so the log is current on soft-nav back.
      refetchOnMount: "always",
      resetScrollKey: scrollResetToken,
    });

  const Header = (
    <div role="row" className={cn(GRID, "items-center border-b p-3 text-sm font-medium text-muted-foreground shrink-0 bg-background rounded-t-lg sticky top-0 z-10 min-w-fit")}>
      <div role="columnheader">{t("colDate")}</div>
      <div role="columnheader">{t("colTime")}</div>
      <div role="columnheader">{t("colActor")}</div>
      <div role="columnheader">{t("colAction")}</div>
      <div role="columnheader">{t("colEntity")}</div>
      <div role="columnheader">{t("colDetails")}</div>
    </div>
  );

  // Selected-value labels, computed once here so the trigger can wrap them in
  // a truncating span - Radix SelectValue only auto-renders the matched
  // SelectItem's children when given none of its own, so overriding the
  // content (to add `truncate`) means resolving the label ourselves, same as
  // SortSelect already does for its own trigger.
  const actionLabel = f.action ? labels.action(f.action) : t("allActions");
  const entityTypeLabel = f.entityType ? labels.entity(f.entityType) : t("allEntities");

  const Filters = (
    <div className="flex flex-wrap items-center gap-3 mb-4">
      <SearchInput
        value={f.search}
        onChange={(v) => setParams({ search: v })}
        placeholder={t("searchPlaceholder")}
        className="min-w-40"
      />
      <Select
        value={f.action || ALL}
        onValueChange={(v) => {
          resetListScroll();
          setParams({ action: v === ALL ? "" : v });
        }}
      >
        <SelectTrigger className="h-9 min-w-0 max-w-[45vw] sm:max-w-none sm:min-w-44">
          <SelectValue placeholder={t("allActions")}>
            {/* truncate-ok: select trigger, the open list shows the full label */}
            <span className="truncate">{actionLabel}</span>
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{t("allActions")}</SelectItem>
          {facets.actions.map((a) => (
            <SelectItem key={a} value={a}>{labels.action(a)}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={f.entityType || ALL}
        onValueChange={(v) => {
          resetListScroll();
          setParams({ entityType: v === ALL ? "" : v });
        }}
      >
        <SelectTrigger className="h-9 min-w-0 max-w-[45vw] sm:max-w-none sm:min-w-40">
          <SelectValue placeholder={t("allEntities")}>
            {/* truncate-ok: select trigger, the open list shows the full label */}
            <span className="truncate">{entityTypeLabel}</span>
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{t("allEntities")}</SelectItem>
          {facets.entityTypes.map((e) => (
            <SelectItem key={e} value={e}>{labels.entity(e)}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <SortSelect
        sortBy="createdAt"
        sortOrder={f.sortOrder}
        onSortByChange={() => {}}
        onSortOrderChange={(order) => setParams({ sortOrder: order })}
        options={[{ value: "createdAt", label: t("colTime") }]}
        triggerClassName="max-w-[45vw] sm:max-w-none"
      />
      <DatePicker
        value={f.dateFrom || null}
        onChange={(v) => {
          resetListScroll();
          setParams({ dateFrom: v ?? "" });
        }}
        placeholder={t("dateFrom")}
        className="w-32 sm:w-40"
      />
      <DatePicker
        value={f.dateTo || null}
        onChange={(v) => {
          resetListScroll();
          setParams({ dateTo: v ?? "" });
        }}
        placeholder={t("dateTo")}
        className="w-32 sm:w-40"
      />
    </div>
  );

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
      <TableScroll>
        {Header}
        {Array.from({ length: 10 }).map((_, i) => <SkeletonRow key={i} />)}
      </TableScroll>
    );
  } else if (items.length === 0) {
    const hasFilters = !!f.search || !!f.action || !!f.entityType || !!f.dateFrom || !!f.dateTo;
    body = (
      <p className="text-sm text-muted-foreground py-10 text-center">
        {hasFilters ? t("noLogs") : t("noEntries")}
      </p>
    );
  } else if (!query.hasNextPage) {
    body = (
      <TableScroll ref={parentRef} locked={isPlaceholderData}>
        {Header}
        {items.map((row) => <Row key={row.id} row={row} dl={dl} labels={labels} />)}
      </TableScroll>
    );
  } else {
    body = (
      <TableScroll ref={parentRef} locked={isPlaceholderData}>
        {Header}
        <div style={{ height: virtualizer.getTotalSize(), position: "relative", width: "100%" }}>
          {virtualizer.getVirtualItems().map((vRow) => {
            const sentinel = isSentinelIndex(vRow.index);
            const row = sentinel ? null : items[vRow.index];
            return (
              <div
                key={sentinel ? "sentinel" : row!.id}
                ref={virtualizer.measureElement}
                data-index={vRow.index}
                style={{ position: "absolute", top: 0, left: 0, width: "100%", transform: `translateY(${vRow.start}px)` }}
              >
                {sentinel ? <SkeletonRow /> : <Row row={row!} dl={dl} labels={labels} />}
              </div>
            );
          })}
        </div>
      </TableScroll>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {Filters}
      {body}
    </div>
  );
}
