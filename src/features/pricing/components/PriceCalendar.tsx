import { useLocale, useTranslations } from "next-intl";
import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { CalendarRow, RuleOverlap } from "../engine/calendar";
import {
  BASE_SWATCH,
  CAL,
  calendarPeriods,
  dayOfMonth,
  displayRows,
  isWeekend,
  longDate,
  monthName,
  periodRange,
} from "./calendarDisplay";

/**
 * A fixed palette, so a rule keeps its colour across rows and reloads. The
 * first rule wears the theme's `--brand-accent`, so the common one-rule
 * calendar matches the rest of the site on every theme; the purples that would
 * read as the same colour beside it are left out.
 */
const SWATCHES = [
  "bg-(--brand-accent)",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-teal-500",
  "bg-orange-500",
  "bg-lime-500",
];

/**
 * The next N days as the seller reads them: a grid (months over day numbers,
 * today first, one row per target that is priced differently) and, under it,
 * the same schedule in words - "Today - 9 Nov: Autumn sale". Built from the
 * same windows the shop prices from. The grid scrolls inside its own box; the
 * page shell never scrolls sideways.
 */
export function PriceCalendar({
  rows,
  overlaps,
  ruleOrder,
  ruleNames,
  rowLabels,
}: {
  rows: CalendarRow[];
  overlaps: RuleOverlap[];
  /** Rule ids in display order; a rule's index picks its colour. */
  ruleOrder: string[];
  ruleNames: Record<string, string>;
  /** Label per row, keyed by variant id ("" for the product row). */
  rowLabels: Record<string, string>;
}) {
  const t = useTranslations("priceRules.calendar");
  const locale = useLocale();
  const swatch = (id: string) => SWATCHES[ruleOrder.indexOf(id) % SWATCHES.length];
  const days = rows[0]?.days ?? [];
  const firstDay = days[0]?.date ?? "";
  const lastDay = days.at(-1)?.date ?? "";
  const display = displayRows(rows, rowLabels, t("allVariants"));
  const describe = (ruleIds: string[]) =>
    ruleIds.length ? ruleIds.map((id) => ruleNames[id] ?? "").join(" + ") : t("base");
  const rangeCopy = { today: t("today"), everyDay: t("everyDay"), from: (date: string) => t("from", { date }) };

  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold">{t("title", { days: days.length })}</h2>

      {overlaps.map((o) => (
        <Alert key={`${o.winnerId}:${o.hiddenId}`}>
          <AlertTriangle />
          <AlertDescription>
            {t("overlap", { hidden: ruleNames[o.hiddenId] ?? "", winner: ruleNames[o.winnerId] ?? "" })}
          </AlertDescription>
        </Alert>
      ))}

      {/* Sixty days are wider than a phone: the strip scrolls sideways under an
          overlay bar (CLAUDE.md, "Scrollbars"), never a native one against the
          border. The viewport is `h-auto` because the strip has no height of
          its own to fill. */}
      <ScrollArea className="rounded-lg border" viewportClassName="h-auto">
        <div className="min-w-fit p-3">
          {/* Month names, each over the first of its days. */}
          <div className={cn("flex", CAL.gap, CAL.headLine)} aria-hidden>
            <div className={CAL.label} />
            {days.map((d, i) => (
              <div key={d.date} className="relative w-5 shrink-0">
                {(i === 0 || dayOfMonth(d.date) === 1) && (
                  <span className="absolute left-0 top-0 whitespace-nowrap text-[11px] font-semibold leading-4">
                    {monthName(d.date, locale)}
                  </span>
                )}
              </div>
            ))}
          </div>
          {/* Day numbers; weekends shaded, today in bold. */}
          <div className={cn("mt-0.5 flex", CAL.gap, CAL.headLine)} aria-hidden>
            <div className={cn(CAL.label, "text-[11px] leading-4 text-muted-foreground")}>{t("today")} →</div>
            {days.map((d, i) => (
              <div
                key={d.date}
                className={cn(
                  "w-5 shrink-0 rounded-sm text-center text-[10px] leading-4 tabular-nums",
                  isWeekend(d.date) ? "bg-muted text-foreground/80" : "text-muted-foreground",
                  i === 0 && "font-bold text-foreground",
                )}
              >
                {dayOfMonth(d.date)}
              </div>
            ))}
          </div>

          <div className="mt-2 space-y-1">
            {display.map(({ key, label, row }) => (
              <div key={key} className={cn("flex items-center", CAL.gap)}>
                <div className={cn(CAL.label, "truncate pr-3 text-xs font-medium")} title={label}>
                  {label}
                </div>
                {row.days.map((d) => (
                  <div
                    key={d.date}
                    title={`${longDate(d.date, locale)}: ${describe(d.ruleIds)}`}
                    className={cn(
                      CAL.cell,
                      d.ruleIds.length === 0 ? BASE_SWATCH : swatch(d.ruleIds[0]),
                      d.ruleIds.length > 1 && "ring-2 ring-inset ring-foreground/50",
                    )}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </ScrollArea>

      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <li className="flex items-center gap-1.5">
          <span className={cn("size-3 rounded-[3px]", BASE_SWATCH)} />
          {t("base")}
        </li>
        {ruleOrder.map((id) => (
          <li key={id} className="flex items-center gap-1.5">
            <span className={cn("size-3 rounded-[3px]", swatch(id))} />
            {ruleNames[id]}
          </li>
        ))}
      </ul>

      {/* The same schedule in words - what the grid means, without decoding it. */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold">{t("schedule")}</h3>
        {display.map(({ key, label, row }) => (
          <div key={key} className="space-y-1">
            {display.length > 1 && <p className="text-xs font-medium text-muted-foreground">{label}</p>}
            <ul className="divide-y rounded-lg border text-sm">
              {calendarPeriods(row.days).map((p) => (
                <li key={p.from} className="flex items-center gap-3 px-3 py-2">
                  <span className="w-36 shrink-0 tabular-nums text-muted-foreground">
                    {periodRange(p, firstDay, lastDay, locale, rangeCopy)}
                  </span>
                  <span
                    className={cn(
                      "size-3 shrink-0 rounded-[3px]",
                      p.ruleIds.length === 0 ? BASE_SWATCH : swatch(p.ruleIds[0]),
                    )}
                  />
                  <span className={cn("truncate", p.ruleIds.length === 0 && "text-muted-foreground")}>
                    {describe(p.ruleIds)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
