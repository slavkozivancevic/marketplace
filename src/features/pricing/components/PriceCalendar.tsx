import { useTranslations } from "next-intl";
import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { CalendarRow, RuleOverlap } from "../engine/calendar";

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
 * The next N days, one row per target (the product, then each variant), one
 * cell per day coloured by the rule(s) that set the price. Built from the same
 * windows the shop prices from. The grid scrolls inside its own box - the page
 * shell never scrolls sideways.
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
  const swatch = (id: string) => SWATCHES[ruleOrder.indexOf(id) % SWATCHES.length];
  const days = rows[0]?.days ?? [];

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
        <div className="min-w-fit p-3 space-y-1.5">
          <div className="flex items-end gap-px pl-40 text-[10px] text-muted-foreground tabular-nums">
            {days.map((d) => (
              <div key={d.date} className="w-4 text-center">
                {d.date.endsWith("-01") || d === days[0] ? d.date.slice(8) : ""}
              </div>
            ))}
          </div>
          {rows.map((row) => (
            <div key={row.variantId ?? ""} className="flex items-center gap-px">
              <div className="w-40 shrink-0 truncate pr-2 text-xs">{rowLabels[row.variantId ?? ""]}</div>
              {row.days.map((d) => (
                <div
                  key={d.date}
                  title={`${d.date}: ${d.ruleIds.length ? d.ruleIds.map((id) => ruleNames[id]).join(", ") : t("base")}`}
                  className={cn(
                    "h-4 w-4 rounded-[3px]",
                    d.ruleIds.length === 0 ? "bg-muted" : swatch(d.ruleIds[0]),
                    d.ruleIds.length > 1 && "ring-1 ring-foreground/60",
                  )}
                />
              ))}
            </div>
          ))}
        </div>
      </ScrollArea>

      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <li className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-[3px] bg-muted" />
          {t("base")}
        </li>
        {ruleOrder.map((id) => (
          <li key={id} className="flex items-center gap-1.5">
            <span className={cn("h-3 w-3 rounded-[3px]", swatch(id))} />
            {ruleNames[id]}
          </li>
        ))}
      </ul>
    </section>
  );
}
