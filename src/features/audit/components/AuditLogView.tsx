"use client";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { AuditLogItem } from "../db/queries";

// Radix Select can't use an empty-string item value, so "all" is the sentinel.
const ALL = "__all__";
const GRID = "grid grid-cols-[155px_minmax(160px,1.2fr)_minmax(170px,1.2fr)_minmax(150px,1fr)_minmax(180px,2fr)] items-center gap-4";

// Action keys we emit and have localized labels for. Unknown (future) keys fall
// back to the raw identifier so the table never breaks on a missing translation.
const KNOWN_ACTIONS = new Set([
  "order.shipped", "order.delivered", "order.cod_paid", "order.cancelled",
  "order.refunded", "order.partially_refunded", "payout.released",
  "return.requested", "return.approved", "return.rejected", "return.shipped", "return.refunded",
  "user.role_changed", "member.role_changed", "member.removed", "organization.verified_changed",
  "product.created", "product.updated", "product.deleted", "product.duplicated",
  "product.published", "product.unpublished", "product.archived", "product.unarchived",
  "product.rolled_back", "product.bulk_status", "product.bulk_deleted", "product.bulk_created",
  "product.bulk_updated",
  "brand.created", "brand.updated", "brand.deleted", "brand.duplicated",
  "category.created", "category.updated", "category.deleted", "category.duplicated",
  "attribute.created", "attribute.updated", "attribute.deleted", "attribute.duplicated",
]);

type Labels = {
  entity: (type: string) => string;
  field: (key: string) => string;
  value: (v: unknown) => string;
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
    const { data } = await axios.get(`/api/admin/audit?${params.toString()}`);
    return data;
  };
}

/** Human-readable summary of the diff: translated keys and enum values,
 *  "from → to" pairs, and the internal `byFilter` flag dropped. */
function renderDiff(diff: AuditLogItem["diff"], labels: Labels): string | null {
  if (!diff || typeof diff !== "object") return null;
  const entries = Object.entries(diff as Record<string, unknown>).filter(([k]) => k !== "byFilter");
  if (entries.length === 0) return null;
  return entries
    .map(([k, v]) => {
      if (v && typeof v === "object" && "from" in v && "to" in v) {
        const o = v as { from: unknown; to: unknown };
        return `${labels.field(k)}: ${labels.value(o.from)} → ${labels.value(o.to)}`;
      }
      return `${labels.field(k)}: ${labels.value(v)}`;
    })
    .join("  ·  ");
}

function Row({ row, dl, labels }: { row: AuditLogItem; dl: string; labels: Labels }) {
  const diff = renderDiff(row.diff, labels);
  const isBulk = row.entityId === "bulk";
  return (
    <div role="row" className={cn(GRID, "border-b px-3 py-2.5 text-sm min-w-fit")}>
      <div className="text-muted-foreground text-xs whitespace-nowrap">
        {new Date(row.createdAt).toLocaleString(dl, {
          year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
        })}
      </div>
      <div className="truncate">
        {row.actorEmail ?? <span className="text-muted-foreground italic">{labels.system}</span>}
      </div>
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
      <div className="text-xs text-muted-foreground truncate" title={diff ?? undefined}>{diff ?? "—"}</div>
    </div>
  );
}

export function AuditLogView({
  facets,
}: {
  facets: { actions: string[]; entityTypes: string[] };
}) {
  const t = useTranslations("admin.audit");
  const dl = dateLocale(useLocale());

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
    Organization: t("entities.organization"),
  };
  const fieldLabels: Record<string, string> = {
    count: t("fields.count"),
    fields: t("fields.fields"),
    amount: t("fields.amount"),
    currency: t("fields.currency"),
    seller: t("fields.seller"),
    status: t("fields.status"),
    role: t("fields.role"),
    member: t("fields.member"),
    verified: t("fields.verified"),
    version: t("fields.version"),
    carrier: t("fields.carrier"),
    tracking: t("fields.tracking"),
    created: t("fields.created"),
    totalRows: t("fields.totalRows"),
    errors: t("fields.errors"),
    external: t("fields.external"),
  };
  // Enum-like values (roles, statuses, booleans) are translated; identifiers
  // (UUIDs, field names, currency codes, numbers) fall through unchanged.
  // Product column names that appear in a bulk update's `fields` list.
  const columnLabels: Record<string, string> = {
    status: t("columns.status"),
    brandId: t("columns.brandId"),
    price: t("columns.price"),
    compareAtPrice: t("columns.compareAtPrice"),
    costPrice: t("columns.costPrice"),
    taxable: t("columns.taxable"),
    requiresShipping: t("columns.requiresShipping"),
    isDigital: t("columns.isDigital"),
    stock: t("columns.stock"),
    categories: t("columns.categories"),
  };
  const valueLabels: Record<string, string> = {
    USER: t("values.USER"),
    ADMIN: t("values.ADMIN"),
    SELLER: t("values.SELLER"),
    OWNER: t("values.OWNER"),
    MEMBER: t("values.MEMBER"),
    REQUESTED: t("values.REQUESTED"),
    APPROVED: t("values.APPROVED"),
    REJECTED: t("values.REJECTED"),
    SHIPPED: t("values.SHIPPED"),
    REFUNDED: t("values.REFUNDED"),
    PUBLISHED: t("values.PUBLISHED"),
    DRAFT: t("values.DRAFT"),
    ARCHIVED: t("values.ARCHIVED"),
    true: t("values.true"),
    false: t("values.false"),
  };
  const labels: Labels = {
    entity: (type) => entityLabels[type] ?? type,
    field: (key) => fieldLabels[key] ?? key,
    value: (v) =>
      Array.isArray(v)
        ? v.map((x) => columnLabels[String(x)] ?? String(x)).join(", ")
        : valueLabels[String(v)] ?? String(v ?? "∅"),
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
  };

  const { parentRef, virtualizer, items, query, isSentinelIndex, isPlaceholderData } =
    useInfiniteVirtualList<AuditLogItem>({
      queryKey: ["audit", f],
      queryFn: buildFetcher(f),
      estimateSize: 49,
    });

  const Header = (
    <div role="row" className={cn(GRID, "border-b p-3 text-sm font-medium text-muted-foreground shrink-0 bg-background rounded-t-lg sticky top-0 z-10 min-w-fit")}>
      <div role="columnheader">{t("colTime")}</div>
      <div role="columnheader">{t("colActor")}</div>
      <div role="columnheader">{t("colAction")}</div>
      <div role="columnheader">{t("colEntity")}</div>
      <div role="columnheader">{t("colDetails")}</div>
    </div>
  );

  const Filters = (
    <div className="flex flex-wrap items-center gap-3 mb-4">
      <SearchInput
        value={f.search}
        onChange={(v) => setParams({ search: v })}
        placeholder={t("searchPlaceholder")}
      />
      <Select
        value={f.action || ALL}
        onValueChange={(v) => setParams({ action: v === ALL ? "" : v })}
      >
        <SelectTrigger className="h-9 min-w-44">
          <SelectValue placeholder={t("allActions")} />
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
        onValueChange={(v) => setParams({ entityType: v === ALL ? "" : v })}
      >
        <SelectTrigger className="h-9 min-w-40">
          <SelectValue placeholder={t("allEntities")} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{t("allEntities")}</SelectItem>
          {facets.entityTypes.map((e) => (
            <SelectItem key={e} value={e}>{labels.entity(e)}</SelectItem>
          ))}
        </SelectContent>
      </Select>
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
  } else if (query.status !== "pending" && items.length === 0) {
    body = <p className="text-sm text-muted-foreground py-10 text-center">{t("noLogs")}</p>;
  } else if (!query.hasNextPage) {
    body = (
      <div role="table" className={cn("rounded-lg border flex-1 min-h-0 overflow-auto", isPlaceholderData && "opacity-50 pointer-events-none transition-opacity duration-150")}>
        {Header}
        {items.map((row) => <Row key={row.id} row={row} dl={dl} labels={labels} />)}
      </div>
    );
  } else {
    body = (
      <div role="table" ref={parentRef} className={cn("rounded-lg border flex-1 min-h-0 overflow-auto", isPlaceholderData && "opacity-50 pointer-events-none transition-opacity duration-150")}>
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
                {sentinel
                  ? <div className="px-3 py-3 text-xs text-muted-foreground">…</div>
                  : <Row row={row!} dl={dl} labels={labels} />}
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
