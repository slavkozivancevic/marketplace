"use client";

import { useTranslations, useLocale } from "next-intl";
import { dateLocale } from "@/lib/i18n/dateLocale";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { formatPrice } from "@/lib/currency";
import type { Currency } from "@/lib/currency-config";
import type { OrgPayoutListItem } from "../db/payouts";

export const PAYOUT_COL =
  "grid-cols-[minmax(120px,1fr)_120px_90px_150px_180px]";

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
      className={cn("grid items-center gap-4 border-b p-3 min-w-fit", PAYOUT_COL)}
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
          keeps the real transfer amount and shows the clawed-back part below. */}
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
      </div>

      {/* Status */}
      <div role="cell" className="flex items-center justify-center gap-1.5">
        {payout.refundState === "full" && (
          <Badge variant="destructive" className="text-[10px]">
            {t("refunded")}
          </Badge>
        )}
        {payout.refundState === "partial" && (
          <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300">
            {t("partiallyRefunded")}
          </Badge>
        )}
        <Badge variant={statusVariant(payout.status)}>
          {statusLabel[payout.status] ?? payout.status}
        </Badge>
      </div>
    </div>
  );
}
