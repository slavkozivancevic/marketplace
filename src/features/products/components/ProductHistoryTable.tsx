"use client";

import * as React from "react";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
    <TableRow className="hover:bg-transparent">
      <TableCell>
        <div className="flex items-center gap-2">
          {entry.version}
          {isLatest && (
            <Badge variant="outline" className="text-xs">
              current
            </Badge>
          )}
        </div>
      </TableCell>
      <TableCell>{entry.title}</TableCell>
      <TableCell>{entry.description}</TableCell>
      <TableCell>${entry.price.toFixed(2)}</TableCell>
      <TableCell>
        <Badge variant={getStatusVariant(entry.status)}>{entry.status}</Badge>
      </TableCell>
      <TableCell>
        {entry.updatedBy?.name ?? entry.updatedBy?.email ?? "—"}
      </TableCell>
      <TableCell>{new Date(entry.createdAt).toLocaleString()}</TableCell>
      <TableCell>
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
      </TableCell>
    </TableRow>
  );
}

export function ProductHistoryTable({
  history,
  productId,
}: ProductHistoryTableProps) {
  const latestVersion = history[0]?.version;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Version</TableHead>
          <TableHead>Title</TableHead>
          <TableHead>Description</TableHead>
          <TableHead>Price</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Updated By</TableHead>
          <TableHead>Created At</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {history.map((entry) => (
          <HistoryRow
            key={entry.id}
            entry={entry}
            productId={productId}
            isLatest={entry.version === latestVersion}
          />
        ))}
      </TableBody>
    </Table>
  );
}
