"use client";

import { useTranslations } from "next-intl";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";
import type { OrgShippingLine } from "@/features/shipping/db/shipping";

/**
 * How long the sellers in this cart take to deliver.
 *
 * Shown as a notice above the lines, because it answers "when will this
 * arrive?" - a question asked before checkout, not during it. Sellers who
 * publish no estimate contribute nothing: this never invents a range, and a
 * cart where nobody published one renders nothing at all.
 *
 * With several sellers the estimates are named, since they can differ and the
 * buyer's order will arrive in separate parts (which is already how
 * `OrderSellerPart` treats it).
 */
export function SellerLeadTimes({
  lines,
  className,
}: {
  lines: OrgShippingLine[];
  className?: string;
}) {
  const t = useTranslations("cart");

  const withEstimate = lines.filter(
    (l) => l.leadTimeMinDays != null && l.leadTimeMaxDays != null,
  );
  if (withEstimate.length === 0) return null;

  const estimate = (l: OrgShippingLine) =>
    l.leadTimeMinDays === l.leadTimeMaxDays
      ? t("leadTimeExact", { count: l.leadTimeMinDays! })
      : t("leadTimeRange", { min: l.leadTimeMinDays!, max: l.leadTimeMaxDays! });

  return (
    <div
      className={cn(
        "flex gap-2 rounded-lg border bg-muted/30 px-3 py-2.5 text-xs",
        className,
      )}
    >
      <Info className="h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="space-y-0.5 min-w-0">
        {withEstimate.length === 1 ? (
          <p>{estimate(withEstimate[0])}</p>
        ) : (
          withEstimate.map((l) => (
            <p key={l.orgId}>
              <span className="font-medium">{l.orgName}:</span> {estimate(l)}
            </p>
          ))
        )}
      </div>
    </div>
  );
}
