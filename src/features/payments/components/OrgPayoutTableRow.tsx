"use client";

import { useTranslations, useLocale } from "next-intl";
import { dateLocale } from "@/lib/i18n/dateLocale";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { formatPrice } from "@/lib/currency";
import type { Currency } from "@/lib/currency-config";
import type { OrgPayoutListItem } from "../db/payouts";

// Status column widened (400px, was 180px) to fit up to three text pills on
// one line - refund state + COD-debt marker + paid/pending/failed - without
// bleeding into the Amount column. Verified against real data where all
// three can appear together (a Stripe payout netted against COD debt, later
// partially refunded). See OrgPayoutTableRow's Status cell.
export const PAYOUT_COL =
  "grid-cols-[minmax(120px,1fr)_120px_90px_150px_400px]";

function statusVariant(status: string) {
  return status === "SUCCEEDED"
    ? ("default" as const)
    : status === "FAILED"
      ? ("destructive" as const)
      : ("secondary" as const);
}

export function OrgPayoutTableRow({ payout }: { payout: OrgPayoutListItem }) {
  const t = useTranslations("payouts");
  const locale = useLocale();
  const dl = dateLocale(locale);

  const statusLabel: Record<string, string> = {
    SUCCEEDED: t("paid"),
    PENDING: t("pendingPayout"),
    FAILED: t("failed"),
  };

  return (
    <div
      role="row"
      className={cn("grid items-center gap-4 border-b h-14 px-3 min-w-fit", PAYOUT_COL)}
    >
      {/* Order ID */}
      <div role="cell" className="font-mono text-xs text-muted-foreground">
        #{payout.orderId.slice(-8).toUpperCase()}
      </div>

      {/* Date */}
      <div role="cell" className="text-sm">
        {new Date(payout.createdAt).toLocaleDateString(dl, {
          year: "numeric",
          month: "short",
          day: "numeric",
        })}
      </div>

      {/* Time */}
      <div role="cell" className="text-sm text-muted-foreground">
        {new Date(payout.createdAt).toLocaleTimeString(dl, {
          hour: "2-digit",
          minute: "2-digit",
        })}
      </div>

      {/* Amount - struck through only on a full reversal; a partial reversal
          keeps the real transfer amount and shows the clawed-back part below.
          codNetted is a separate, earlier reduction (COD debt withheld at
          transfer time) - shown the same way so both are visible at a glance. */}
      <div role="cell" className="flex flex-col items-end gap-0.5">
        <span
          className={cn(
            "font-semibold text-sm tabular-nums",
            payout.refundState === "full" && "text-muted-foreground line-through",
          )}
        >
          {formatPrice(payout.amount, payout.currency as Currency)}
        </span>
        {payout.refundState === "partial" && (
          <span className="text-[11px] text-destructive tabular-nums">
            -{formatPrice(payout.reversedNet, payout.currency as Currency)}
          </span>
        )}
        {payout.codNetted > 0 && (
          <span className="text-[11px] text-steel tabular-nums">
            -{formatPrice(payout.codNetted, payout.currency as Currency)} {t("codBalanceNettedShort")}
          </span>
        )}
      </div>

      {/* Status */}
      <div role="cell" className="flex items-center justify-center gap-1.5">
        {payout.refundState === "full" && (
          <Badge variant="destructive" className="text-[10px]">
            {t("refunded")}
          </Badge>
        )}
        {payout.refundState === "partial" && (
          <Badge variant="outline" className="text-[10px] text-steel border-steel/40">
            {t("partiallyRefunded")}
          </Badge>
        )}
        {payout.codNetted > 0 && (
          <Badge
            variant="outline"
            className="text-[10px] text-steel border-steel/40"
            title={t("codBalanceNettedNote")}
          >
            {t("codBalanceNettedPill")}
          </Badge>
        )}
        <Badge variant={statusVariant(payout.status)}>
          {statusLabel[payout.status] ?? payout.status}
        </Badge>
      </div>
    </div>
  );
}
