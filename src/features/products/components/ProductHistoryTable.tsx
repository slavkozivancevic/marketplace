"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ActionButton } from "@/components/ActionButton";
import { toast } from "@/components/ui/sonner";
import { rollbackProductVersion } from "@/features/products/actions/products";
import { SerializedProductHistory } from "@/types/types";

interface ProductHistoryTableProps {
  history: SerializedProductHistory[];
  productId: string;
}

const GRID_COLS = "grid-cols-[60px_64px_minmax(140px,1fr)_minmax(200px,2fr)_80px_100px_minmax(120px,1fr)_minmax(180px,1fr)_100px]";

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
  return (
    <div
      role="row"
      className={`grid ${GRID_COLS} items-center gap-2 border-b p-3 text-sm font-medium text-muted-foreground shrink-0 bg-background rounded-t-lg`}
    >
      <div role="columnheader">Version</div>
      <div role="columnheader"><Badge variant="outline" className="text-xs invisible">current</Badge></div>
      <div role="columnheader">Title</div>
      <div role="columnheader">Description</div>
      <div role="columnheader">Price</div>
      <div role="columnheader">Status</div>
      <div role="columnheader">Updated By</div>
      <div role="columnheader">Created At</div>
      <div role="columnheader">Actions</div>
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
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleRollback = () => {
    startTransition(async () => {
      const result = await rollbackProductVersion(productId, entry.version);
      if (result && "error" in result) {
        toast.error(result.message);
      } else {
        toast.success(`Rolled back to version ${entry.version}`);
        router.push(`/admin/products/${productId}/history`);
        router.refresh();
      }
    });
  };

  return (
    <div
      role="row"
      className={`grid ${GRID_COLS} items-center gap-2 border-b p-3 transition-colors`}
    >
      <div role="cell">{entry.version}</div>
      <div role="cell">
        <Badge variant="outline" className={`text-xs ${isLatest ? "" : "invisible"}`}>
          current
        </Badge>
      </div>
      <div role="cell" className="truncate">{entry.title}</div>
      <div role="cell" className="truncate text-muted-foreground">{entry.description}</div>
      <div role="cell">${entry.price.toFixed(2)}</div>
      <div role="cell">
        <Badge variant={getStatusVariant(entry.status)}>{entry.status}</Badge>
      </div>
      <div role="cell" className="truncate">
        {entry.updatedBy?.name ?? entry.updatedBy?.email ?? "—"}
      </div>
      <div role="cell" className="truncate">{new Date(entry.createdAt).toLocaleString()}</div>
      <div role="cell">
        {!isLatest && (
          <ActionButton
            title="Rollback to this version"
            description={`Are you sure you want to rollback to version ${entry.version}? This will create a new version with this data.`}
            confirmText="Rollback"
            onConfirm={handleRollback}
          >
            <Button variant="outline" size="sm" disabled={isPending}>
              {isPending ? "Rolling back..." : "Rollback"}
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
    <div role="table" className="rounded-lg border flex flex-col flex-1 min-h-0">
      <HistoryTableHeader />
      <div className="overflow-auto flex-1 min-h-0">
        {history.map((entry) => (
          <HistoryRow
            key={entry.id}
            entry={entry}
            productId={productId}
            isLatest={entry.version === latestVersion}
          />
        ))}
      </div>
    </div>
  );
}