"use client";

import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { AlertTriangle, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Skeleton,
  SkeletonBreadcrumbs,
  SkeletonButton,
  SkeletonCopy,
  SkeletonPageHeader,
} from "@/components/ui/skeleton";
import { TableScroll } from "@/components/ui/table-scroll";
import { VerificationRequiredNotice } from "@/components/VerificationRequiredNotice";
import { readRouteShape } from "@/lib/navigation/routeShape";
import { PRICE_RULES_PER_PRODUCT_MAX } from "../schema/priceRules";
import { PRICE_RULES_GRID } from "./priceRulesGrid";
import { useRuleCellText } from "./useRuleCellText";
import type { PricingListView } from "./pricingListView";
import type { PricingScope } from "./PriceRulesScreens";

/** What a page linking to the rules list hands its skeleton (see PriceRulesLink). */
export type PricingListShape = { view: PricingListView; canWrite: boolean; verified: boolean };

export function pricingListShapeKey(productId: string): string {
  return `price-rules:${productId}`;
}

const STATUS_VARIANT = { live: "default", upcoming: "outline", paused: "secondary", ended: "secondary" } as const;
/** One cell per calendar day - the list's CALENDAR_DAYS. */
const DAYS = 60;

/**
 * The price-rules list's route skeleton, row for row with <PriceRulesScreen>:
 * alerts, the sort and market notes, <PriceRulesTable> and <PriceCalendar>.
 *
 * Everything below the header is the product's data - how many rules, which
 * kinds, what their schedules read (a long one wraps), how many calendar rows
 * and overlap alerts - so the page that links here hands the list's own view
 * over on the click, and this draws exactly that, every known string as real
 * transparent text. Opened any other way (a hard load, the form's redirect
 * after a save) it falls back to three rules and a one-row calendar.
 */
export function PriceRulesListSkeleton({ scope }: { scope: PricingScope }) {
  const t = useTranslations("priceRules");
  const params = useParams<{ id?: string }>();
  const shape = params.id ? readRouteShape<PricingListShape>(pricingListShapeKey(params.id)) : null;
  const writable = shape ? shape.canWrite && shape.verified : true;
  // On the dashboard "Add rule" is permission-gated; without the handed-over
  // rights it is left out, the call the my-products detail skeleton makes.
  const showAdd = shape ? writable : scope === "admin";

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="shrink-0 px-6 pt-2 sticky-header-bg">
        {/* Root crumbs, product title, "Price rules". */}
        <SkeletonBreadcrumbs
          segments={4}
          widths={scope === "admin" ? ["w-9", "w-12", "w-24", "w-16"] : ["w-20", "w-20", "w-24", "w-16"]}
        />
        <SkeletonPageHeader
          title={t("title")}
          description={shape ? t("description", { title: shape.view.title }) : undefined}
          descriptionWidth="w-80 max-w-full"
          actions={
            <>
              <SkeletonButton label={t("backToProduct")} />
              {showAdd && <SkeletonButton label={t("addRule")} />}
            </>
          }
        />
      </div>
      <div aria-hidden className="flex-1 overflow-y-auto min-h-0 px-6 pb-6 space-y-6">
        {shape ? <HandedOverBody shape={shape} /> : <DefaultBody />}
      </div>
    </div>
  );
}

function HandedOverBody({ shape }: { shape: PricingListShape }) {
  const t = useTranslations("priceRules");
  const tCal = useTranslations("priceRules.calendar");
  const { view, canWrite, verified } = shape;
  const writable = canWrite && verified;
  const { change, schedule } = useRuleCellText(view.marketNames);

  return (
    <>
      {!canWrite && <SkeletonAlert icon={<Info />}>{t("readOnly")}</SkeletonAlert>}
      {canWrite && !verified && (
        <div className="animate-pulse **:text-transparent **:[svg]:opacity-0">
          <VerificationRequiredNotice title={t("verifyTitle")} description={t("verifyDesc")} />
        </div>
      )}
      {writable && view.atLimit && (
        <SkeletonAlert icon={<Info />}>{t("limitReached", { max: PRICE_RULES_PER_PRODUCT_MAX })}</SkeletonAlert>
      )}
      <p className="text-sm">
        <SkeletonCopy>{t("sortNote")}</SkeletonCopy>
      </p>
      {view.hasMarketRules && (
        <p className="text-sm">
          <SkeletonCopy>{t("marketNote")}</SkeletonCopy>
        </p>
      )}

      {view.rules.length === 0 ? (
        <p className="rounded-lg border p-6 text-sm">
          <SkeletonCopy>{t("empty")}</SkeletonCopy>
        </p>
      ) : (
        <TableScroll height="auto">
          <TableHeader writable={writable} />
          {view.rules.map((r) => (
            <div
              key={r.id}
              role="row"
              className={cn(PRICE_RULES_GRID, "border-b last:border-b-0 px-3 py-2.5 text-sm min-w-fit")}
            >
              <div className="font-medium truncate">
                <SkeletonCopy>{r.name}</SkeletonCopy>
              </div>
              <div className="truncate">
                <SkeletonCopy>
                  {r.variantId ? t("variant", { sku: view.variantSku[r.variantId] ?? "" }) : t("wholeProduct")}
                </SkeletonCopy>
              </div>
              <div className="tabular-nums">
                <SkeletonCopy>{change(r)}</SkeletonCopy>
              </div>
              <div>
                <SkeletonCopy>{schedule(r)}</SkeletonCopy>
              </div>
              <div className="text-right tabular-nums">
                <SkeletonCopy>{String(r.priority)}</SkeletonCopy>
              </div>
              <div className="text-center">
                <Badge variant={STATUS_VARIANT[r.status]} className="animate-pulse border-transparent bg-muted text-transparent">
                  {t(`status.${r.status}`)}
                </Badge>
              </div>
              <RowActions writable={writable} />
            </div>
          ))}
        </TableScroll>
      )}

      {/* <PriceCalendar>: schedule rules only. */}
      {view.scheduleRuleIds.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-base font-semibold">
            <SkeletonCopy>{tCal("title", { days: view.calendarRows[0]?.days.length ?? DAYS })}</SkeletonCopy>
          </h2>
          {view.overlaps.map((o) => (
            <SkeletonAlert key={`${o.winnerId}:${o.hiddenId}`} icon={<AlertTriangle />}>
              {tCal("overlap", { hidden: view.ruleNames[o.hiddenId] ?? "", winner: view.ruleNames[o.winnerId] ?? "" })}
            </SkeletonAlert>
          ))}
          <CalendarStrip labels={view.calendarRows.map((row) => view.rowLabels[row.variantId ?? ""] ?? "")} />
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
            <LegendItem>{tCal("base")}</LegendItem>
            {view.scheduleRuleIds.map((id) => (
              <LegendItem key={id}>{view.ruleNames[id]}</LegendItem>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

/** No hand-over: three rules (writable) and the calendar for the product alone. */
function DefaultBody() {
  const t = useTranslations("priceRules");
  const tCal = useTranslations("priceRules.calendar");
  return (
    <>
      <p className="text-sm">
        <SkeletonCopy>{t("sortNote")}</SkeletonCopy>
      </p>
      <TableScroll height="auto">
        <TableHeader writable />
        {Array.from({ length: 3 }, (_, i) => (
          <div
            key={i}
            role="row"
            className={cn(PRICE_RULES_GRID, "border-b last:border-b-0 px-3 py-2.5 text-sm min-w-fit")}
          >
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-3.5 w-12" />
            <Skeleton className="h-3.5 w-44" />
            <Skeleton className="h-3.5 w-4 ml-auto" />
            {/* Status is a <Badge>: 20px tall. */}
            <div className="flex justify-center">
              <Skeleton className="h-5 w-16 rounded-md" />
            </div>
            <RowActions writable />
          </div>
        ))}
      </TableScroll>
      <section className="space-y-3">
        <h2 className="text-base font-semibold">
          <SkeletonCopy>{tCal("title", { days: DAYS })}</SkeletonCopy>
        </h2>
        <CalendarStrip labels={[t("wholeProduct")]} />
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
          <LegendItem>{tCal("base")}</LegendItem>
        </ul>
      </section>
    </>
  );
}

function TableHeader({ writable }: { writable: boolean }) {
  const t = useTranslations("priceRules");
  return (
    <div role="row" className={cn(PRICE_RULES_GRID, "border-b bg-muted/40 px-3 py-2 text-xs font-medium min-w-fit")}>
      <div><SkeletonCopy>{t("table.name")}</SkeletonCopy></div>
      <div><SkeletonCopy>{t("table.appliesTo")}</SkeletonCopy></div>
      <div><SkeletonCopy>{t("table.change")}</SkeletonCopy></div>
      <div><SkeletonCopy>{t("table.schedule")}</SkeletonCopy></div>
      <div className="text-right"><SkeletonCopy>{t("table.priority")}</SkeletonCopy></div>
      <div className="text-center"><SkeletonCopy>{t("table.status")}</SkeletonCopy></div>
      <div className="text-right pr-2.5">{writable && <SkeletonCopy>{t("table.actions")}</SkeletonCopy>}</div>
    </div>
  );
}

/** Edit, duplicate, delete - h-8 icon buttons; a reader's row has none. */
function RowActions({ writable }: { writable: boolean }) {
  return (
    <div className="flex items-center justify-end gap-1">
      {writable && (
        <>
          <Skeleton className="h-8 w-8 rounded-lg" />
          <Skeleton className="h-8 w-8 rounded-lg" />
          <Skeleton className="h-8 w-8 rounded-lg" />
        </>
      )}
    </div>
  );
}

/** The real <Alert> box, its text transparent and its icon hidden. */
function SkeletonAlert({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Alert className="animate-pulse [&>svg]:opacity-0">
      {icon}
      <AlertDescription>
        <SkeletonCopy>{children}</SkeletonCopy>
      </AlertDescription>
    </Alert>
  );
}

/**
 * The calendar strip: a bordered box (the real one scrolls sideways under an
 * overlay bar, which takes no height), the day-number line (`text-[10px]`, a
 * 15px line) and one row of 16px day cells per target, labelled in `text-xs`.
 */
function CalendarStrip({ labels }: { labels: string[] }) {
  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="min-w-fit p-3 space-y-1.5">
        <div className="h-3.75 pl-40" />
        {labels.map((label, i) => (
          <div key={i} className="flex items-center gap-px">
            <div className="w-40 shrink-0 truncate pr-2 text-xs">
              <SkeletonCopy>{label}</SkeletonCopy>
            </div>
            {Array.from({ length: DAYS }, (_, d) => (
              <Skeleton key={d} className="h-4 w-4 shrink-0 rounded-[3px]" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function LegendItem({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-1.5">
      <Skeleton className="h-3 w-3 rounded-[3px]" />
      <SkeletonCopy>{children}</SkeletonCopy>
    </li>
  );
}
