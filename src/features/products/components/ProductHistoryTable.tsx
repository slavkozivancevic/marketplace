"use client";

import { useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { dateLocale } from "@/lib/i18n/dateLocale";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ActionButton } from "@/components/ActionButton";
import { toast } from "@/components/ui/sonner";
import { useAnnounceWhenSettled } from "@/lib/hooks/useAnnounceWhenSettled";
import { rollbackProductVersion } from "@/features/products/actions/products";
import { SerializedProductHistory } from "@/types/types";
import { useMoney } from "@/lib/useMoney";
// Grid template is owned by the skeleton module so the two can never drift.
import { HISTORY_COLS as GRID_COLS } from "./ProductHistoryTableSkeleton";

interface ProductHistoryTableProps {
  history: SerializedProductHistory[];
  productId: string;
}

function getStatusVariant(status: string) {
  switch (status) {
    case "PUBLISHED":
      return "default" as const;
    case "DRAFT":
      return "secondary" as const;
    default:
      return "destructive" as const;
  }
}

function HistoryTableHeader() {
  const t = useTranslations("products");
  return (
    <div
      role="row"
      className={`grid ${GRID_COLS} items-center gap-2 border-b p-3 text-sm font-medium text-muted-foreground shrink-0 bg-background rounded-t-lg sticky top-0 z-10 min-w-fit`}
    >
      <div role="columnheader" className="truncate">{t("historyVersion")}</div>
      {/* "Current" badge column is centered (it's a badge cell), so the header
          placeholder badge - rendered invisible to keep header height aligned -
          is also centered. */}
      <div role="columnheader" className="flex justify-center">
        <Badge variant="outline" className="text-xs invisible">{t("historyCurrent")}</Badge>
      </div>
      <div role="columnheader" className="truncate">{t("historyTitle")}</div>
      <div role="columnheader" className="truncate">{t("historyDescription")}</div>
      <div role="columnheader" className="truncate text-right">{t("historyPrice")}</div>
      <div role="columnheader" className="truncate text-center">{t("historyStatus")}</div>
      <div role="columnheader" className="truncate">{t("historyUpdatedBy")}</div>
      <div role="columnheader" className="truncate">{t("historyDate")}</div>
      <div role="columnheader" className="truncate">{t("historyTime")}</div>
      {/* Rollback is a labeled button (not an icon row) - keeping the column
          LEFT-aligned reads more naturally than right-anchoring a wide button. */}
      <div role="columnheader" className="truncate">{t("historyActions")}</div>
    </div>
  );
}

function HistoryRow({
  entry,
  productId,
  isLatest,
}: {
  entry: SerializedProductHistory;
  productId: string;
  isLatest: boolean;
}) {
  const t = useTranslations("products");
  // Stored per-currency amounts; no rate on the display path.
  const { format } = useMoney();
  const [isPending, startTransition] = useTransition();
  const announceRolledBack = useAnnounceWhenSettled(isPending);
  const router = useRouter();
  const locale = useLocale();
  const dl = dateLocale(locale);

  const handleRollback = () => {
    startTransition(async () => {
      const result = await rollbackProductVersion(productId, entry.version);
      if (result && "error" in result) {
        toast.error(result.message);
      } else {
        // Announced once the refreshed history actually shows the rollback: the
        // refresh rides inside this transition, so the confirm dialog's spinner
        // runs until then and the toast lands with the new row, not before it.
        announceRolledBack({
          message: t("historyRollbackSuccess", { version: entry.version }),
        });
        router.push(`/${locale}/admin/products/${productId}/history`);
        router.refresh();
      }
    });
  };

  return (
    <div
      role="row"
      className={`grid ${GRID_COLS} items-center gap-2 border-b p-3 transition-colors min-w-fit`}
    >
      <div role="cell">{entry.version}</div>
      <div role="cell" className="flex justify-center">
        <Badge variant="outline" className={`text-xs ${isLatest ? "" : "invisible"}`}>
          {t("historyCurrent")}
        </Badge>
      </div>
      <div role="cell" className="truncate">{entry.title}</div>
      <div role="cell" className="truncate text-muted-foreground">{entry.description}</div>
      <div role="cell" className="text-right tabular-nums">
        {format(entry.priceMoney)}
      </div>
      <div role="cell" className="flex justify-center">
        <Badge variant={getStatusVariant(entry.status)}>
          {t(entry.status.toLowerCase() as "published" | "draft" | "archived")}
        </Badge>
      </div>
      <div role="cell" className="truncate">
        {entry.updatedBy?.name ?? entry.updatedBy?.email ?? "-"}
      </div>
      <div role="cell" className="truncate">
        {new Date(entry.createdAt).toLocaleDateString(dl, {
          year: "numeric",
          month: "short",
          day: "numeric",
        })}
      </div>
      <div role="cell" className="truncate text-muted-foreground">
        {new Date(entry.createdAt).toLocaleTimeString(dl, {
          hour: "2-digit",
          minute: "2-digit",
        })}
      </div>
      <div role="cell">
        {!isLatest && (
          <ActionButton
            title={t("historyRollbackTitle")}
            description={t("historyRollbackDesc", { version: entry.version })}
            confirmText={t("historyRollback")}
            loadingText={t("historyRollingBack")}
            // Without this the dialog had no way to know the action had
            // finished: it prevents Radix's auto-close and then waits for
            // `isLoading` to fall, so it simply stayed open after a rollback.
            isLoading={isPending}
            onConfirm={handleRollback}
          >
            <Button variant="outline" size="sm" disabled={isPending}>
              {isPending && <Loader2 className="animate-spin" />}
              {isPending ? t("historyRollingBack") : t("historyRollback")}
            </Button>
          </ActionButton>
        )}
      </div>
    </div>
  );
}

export function ProductHistoryTable({
  history,
  productId,
}: ProductHistoryTableProps) {
  const latestVersion = history[0]?.version;

  return (
    <div role="table" className="rounded-lg border flex-1 min-h-0 overflow-auto [scrollbar-gutter:stable]">
      <HistoryTableHeader />
      {history.map((entry) => (
        <HistoryRow
          key={entry.id}
          entry={entry}
          productId={productId}
          isLatest={entry.version === latestVersion}
        />
      ))}
    </div>
  );
}