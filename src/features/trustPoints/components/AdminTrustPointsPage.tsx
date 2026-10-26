"use client";

import { useMemo, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Copy, Loader2, Pencil, Trash2 } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { useAnnounceWhenSettled } from "@/lib/hooks/useAnnounceWhenSettled";
import { TruncatedTooltip } from "@/components/TruncatedTooltip";
import { SearchInput } from "@/components/search/SearchInput";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ActionButton } from "@/components/ActionButton";
import { deleteTrustPointAction, duplicateTrustPointAction } from "../actions/trustPoints";
import type { TrustPointListItem } from "../db/trustPoints";
import { getTrustPointLabel } from "../utils/translations";
import { TRUST_POINT_FALLBACK_ICON, TRUST_POINT_ICONS } from "../icons";
import { TRUST_POINT_COLS } from "./TrustPointTableSkeleton";
import { TableScroll } from "@/components/ui/table-scroll";
import { IconButton } from "@/components/IconButton";

// Column layout (label | icon | order | status | actions) is owned by the
// skeleton module so the two can never drift.
const COLS = TRUST_POINT_COLS;

function TrustPointTableHeader() {
  const t = useTranslations("trustPoints");
  return (
    <div
      role="row"
      className="grid items-center gap-4 border-b p-3 text-sm font-medium text-muted-foreground bg-background rounded-t-lg sticky top-0 z-10 min-w-fit"
      style={{ gridTemplateColumns: COLS }}
    >
      <div role="columnheader">{t("label")}</div>
      <div role="columnheader">{t("icon")}</div>
      <div role="columnheader" className="text-right">{t("order")}</div>
      <div role="columnheader" className="text-center">{t("status")}</div>
      <div role="columnheader" className="text-right pr-2.5">{t("actions")}</div>
    </div>
  );
}

function TrustPointTableRow({
  point,
  displayLabel,
  onDelete,
  onEdit,
  onDuplicate,
  isDeleting,
  isEditing,
  isDuplicating,
  deleteOpen,
  onDeleteOpenChange,
}: {
  point: TrustPointListItem;
  displayLabel: string;
  onDelete: (id: string) => void;
  onEdit: (id: string) => void;
  onDuplicate: (id: string) => void;
  isDeleting: boolean;
  isEditing: boolean;
  isDuplicating: boolean;
  /**
   * Owned by the page, not the row, so the page can steer it from inside the
   * delete transition. On success it is never closed by hand: the refreshed
   * list drops the row and this dialog with it, in the same frame the spinner
   * stops. On failure it stays open with the reason.
   */
  deleteOpen: boolean;
  onDeleteOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("trustPoints");
  const tCommon = useTranslations("common");
  const tProducts = useTranslations("products");
  const Icon = TRUST_POINT_ICONS[point.icon] ?? TRUST_POINT_FALLBACK_ICON;

  return (
    <div
      role="row"
      className="grid items-center gap-4 border-b p-3 min-w-fit"
      style={{ gridTemplateColumns: COLS }}
    >
      <TruncatedTooltip content={displayLabel}>
        <div role="cell" className="font-medium truncate">{displayLabel}</div>
      </TruncatedTooltip>
      <div role="cell" className="flex items-center gap-2 text-xs text-muted-foreground min-w-0">
        <Icon className="h-4 w-4 shrink-0" />
        <span className="truncate">{point.icon}</span>
      </div>
      <div role="cell" className="text-right tabular-nums text-sm">{point.order}</div>
      <div role="cell" className="flex justify-center">
        <Badge variant={point.isActive ? "default" : "secondary"}>
          {point.isActive ? t("active") : t("inactive")}
        </Badge>
      </div>
      <div role="cell" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-end gap-1">
          <IconButton
            label={tCommon("edit")}
            variant="ghost"
            size="icon"
            disabled={isEditing}
            onClick={() => onEdit(point.id)}
          >
            {isEditing
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <Pencil className="h-4 w-4" />}
          </IconButton>
          <IconButton
            label={t("duplicate")}
            variant="ghost"
            size="icon"
            disabled={isDuplicating}
            onClick={() => onDuplicate(point.id)}
          >
            {isDuplicating
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <Copy className="h-4 w-4" />}
          </IconButton>
          <ActionButton
            open={deleteOpen}
            onOpenChange={onDeleteOpenChange}
            title={t("deleteConfirm", { name: displayLabel })}
            description={t("deleteDesc")}
            confirmText={tCommon("delete")}
            loadingText={tProducts("deleting")}
            isLoading={isDeleting}
            onConfirm={() => onDelete(point.id)}
          >
            {/* Resting control - the dialog's confirm button carries the
                spinner. */}
            <IconButton label={tCommon("delete")} variant="ghost" size="icon">
              <Trash2 className="h-4 w-4 text-destructive" />
            </IconButton>
          </ActionButton>
        </div>
      </div>
    </div>
  );
}

export function AdminTrustPointsPage({ points }: { points: TrustPointListItem[] }) {
  const t = useTranslations("trustPoints");
  const locale = useLocale();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteOpenId, setDeleteOpenId] = useState<string | null>(null);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isNavigating, startNavigate] = useTransition();
  const [isDuplicating, startDuplicate] = useTransition();
  // The toast waits for the refreshed list, so it lands with the row it
  // describes rather than beside a row still on screen.
  const announceDeleted = useAnnounceWhenSettled(isPending);
  const announceDuplicated = useAnnounceWhenSettled(isDuplicating);

  const localized = useMemo(
    () =>
      points.map((p) => ({ point: p, displayLabel: getTrustPointLabel(p, locale) })),
    [points, locale],
  );

  const filtered = useMemo(() => {
    if (!search) return localized;
    const q = search.toLowerCase();
    return localized.filter(
      ({ point, displayLabel }) =>
        displayLabel.toLowerCase().includes(q) ||
        point.icon.toLowerCase().includes(q) ||
        // Any locale's label, so an admin can paste a snippet from whichever
        // language they were looking at and still find the row.
        point.translations.some(
          (tr) =>
            tr.label.toLowerCase().includes(q) ||
            (tr.sublabel ?? "").toLowerCase().includes(q),
        ),
    );
  }, [localized, search]);

  const handleDelete = (id: string) => {
    setDeletingId(id);
    startTransition(async () => {
      const result = await deleteTrustPointAction(id);
      if (result && "error" in result) {
        // Leave the dialog open so the reason stays readable, and re-arm the
        // confirm button for a retry.
        toast.error(result.message);
        setDeletingId(null);
        return;
      }
      // Neither the dialog nor the toast is touched here: the row is still on
      // screen, and confirming now would announce a deletion the user can still
      // see. `router.refresh()` inside the transition keeps the spinner alive
      // until the refreshed list commits - the frame where the row (and the
      // dialog inside it) disappears, and where the queued toast fires.
      announceDeleted({ message: t("deleted") });
      router.refresh();
    });
  };

  const handleEdit = (id: string) => {
    setEditingId(id);
    startNavigate(() => router.push(`/${locale}/admin/trust-points/${id}/edit`));
  };

  const handleDuplicate = (id: string) => {
    setDuplicatingId(id);
    startDuplicate(async () => {
      const result = await duplicateTrustPointAction(id);
      if (!("id" in result)) {
        toast.error(result.message);
        setDuplicatingId(null);
        return;
      }
      const copyId = result.id;
      // The copy exists on the server; the list still does not show it.
      // Announce it when it does - the spinner runs until then, for the same
      // reason the delete one does.
      announceDuplicated({
        message: t("duplicated"),
        action: {
          label: t("editCopy"),
          onClick: () => router.push(`/${locale}/admin/trust-points/${copyId}/edit`),
        },
      });
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-4 flex-1 min-h-0">
      <div className="flex flex-wrap items-center gap-3 shrink-0">
        <SearchInput value={search} onChange={setSearch} placeholder={t("searchPlaceholder")} />
        <span className="text-xs text-muted-foreground ml-auto tabular-nums">
          {filtered.length.toLocaleString()}{" "}
          {filtered.length !== 1 ? t("points") : t("point")}
        </span>
      </div>

      {filtered.length === 0 ? (
        <Alert>
          <AlertTitle>{search ? t("noneFound") : t("none")}</AlertTitle>
          <AlertDescription>
            {search ? t("adjustSearch") : t("createFirst")}
          </AlertDescription>
        </Alert>
      ) : (
        <TableScroll locked={isPending || isNavigating || isDuplicating}>
          <TrustPointTableHeader />
          {filtered.map(({ point, displayLabel }) => (
            <TrustPointTableRow
              key={point.id}
              point={point}
              displayLabel={displayLabel}
              onDelete={handleDelete}
              onEdit={handleEdit}
              onDuplicate={handleDuplicate}
              isDeleting={isPending && deletingId === point.id}
              isEditing={isNavigating && editingId === point.id}
              isDuplicating={isDuplicating && duplicatingId === point.id}
              deleteOpen={deleteOpenId === point.id}
              onDeleteOpenChange={(open) => setDeleteOpenId(open ? point.id : null)}
            />
          ))}
        </TableScroll>
      )}
    </div>
  );
}
