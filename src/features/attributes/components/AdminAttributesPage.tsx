"use client";

import { useMemo, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Copy, Loader2, Pencil, Trash2 } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { useAnnounceWhenSettled } from "@/lib/hooks/useAnnounceWhenSettled";
import { SearchInput } from "@/components/search/SearchInput";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ActionButton } from "@/components/ActionButton";
import {
  deleteAttributeAction,
  duplicateAttributeAction,
} from "../actions/attributes";
import type { AttributeListItem } from "../db/attributes";
import { getAttributeLabel } from "../utils/translations";
import { cn } from "@/lib/utils";
import { TruncatedTooltip } from "@/components/TruncatedTooltip";
import { ATTRIBUTE_COLS } from "./AttributeTableSkeleton";

// Column layout (label | key | type | usage | actions) is owned by the
// skeleton module so the two can never drift. It needs an explicit floor like
// every other table's `minmax(Npx,1fr)` - a bare `1fr` can collapse toward 0
// alongside the container's `min-w-fit`, letting the row's text visually spill
// past the column edge into the Key column instead of being clipped.
const GRID = ATTRIBUTE_COLS;

export function AdminAttributesPage({
  attributes,
}: {
  attributes: AttributeListItem[];
}) {
  const t = useTranslations("adminAttributes");
  const locale = useLocale();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [deleteOpenId, setDeleteOpenId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isNavigating, startNavigate] = useTransition();
  const [isDuplicating, startDuplicate] = useTransition();
  // Toasts wait for the refreshed list, so they land with the row they describe.
  const announceDeleted = useAnnounceWhenSettled(isPending);
  const announceDuplicated = useAnnounceWhenSettled(isDuplicating);

  const filtered = useMemo(() => {
    if (!search) return attributes;
    const q = search.toLowerCase();
    return attributes.filter(
      (a) =>
        a.key.toLowerCase().includes(q) ||
        a.translations.some((tr) => tr.label.toLowerCase().includes(q)),
    );
  }, [attributes, search]);

  const handleDelete = (id: string) => {
    setDeletingId(id);
    startTransition(async () => {
      const result = await deleteAttributeAction(id);
      if (result && "error" in result) {
        // Leave the dialog open so the reason stays readable, and re-arm the
        // confirm button for a retry.
        toast.error(result.message);
        setDeletingId(null);
        return;
      }
      // Neither closed nor announced here - the row is still on screen. The
      // refresh below carries the transition, so the spinner runs until the
      // refreshed list drops the row; the dialog is rendered inside that row and
      // unmounts with it, and the queued toast fires in the same frame. This also
      // settles the old exit-animation problem for good: there is no animation
      // left to play with a button snapped back to its idle state, because the
      // popup is gone the instant its row is.
      //
      // `deletingId` stays set for the same reason it always did.
      announceDeleted({ message: t("deleted") });
      router.refresh();
    });
  };

  const handleDuplicate = (id: string) => {
    setDuplicatingId(id);
    startDuplicate(async () => {
      const result = await duplicateAttributeAction(id);
      if (!("id" in result)) {
        toast.error(result.message);
        setDuplicatingId(null);
        return;
      }
      const copyId = result.id;
      // The copy exists on the server; the list still doesn't show it. Announce
      // it when it does - the spinner runs until then, for the same reason.
      announceDuplicated({
        message: t("duplicated"),
        action: {
          label: t("editCopy"),
          onClick: () => router.push(`/${locale}/admin/attributes/${copyId}/edit`),
        },
      });
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-4 flex-1 min-h-0">
      <div className="flex flex-wrap items-center gap-3 shrink-0">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder={t("searchPlaceholder")}
        />
        <span className="text-xs text-muted-foreground ml-auto tabular-nums">
          {attributes.length} {t("total")}
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
        <div
          className={cn(
            "rounded-lg border flex-1 min-h-0 overflow-auto",
            (isPending || isNavigating || isDuplicating) &&
              "opacity-60 pointer-events-none transition-opacity duration-150",
          )}
        >
          {/* Header */}
          <div
            className="grid items-center gap-3 border-b p-3 text-xs font-medium text-muted-foreground bg-background sticky top-0 z-10 min-w-fit"
            style={{ gridTemplateColumns: GRID }}
          >
            <div>{t("label")}</div>
            <div>{t("key")}</div>
            <div className="text-center">{t("type")}</div>
            <div className="text-right">{t("usage")}</div>
            <div className="text-right pr-2.5">{t("actions")}</div>
          </div>

          {filtered.map((row) => (
            <div
              key={row.id}
              className="grid items-center gap-3 border-b p-3 min-w-fit"
              style={{ gridTemplateColumns: GRID }}
            >
              {/* Label */}
              <TruncatedTooltip content={getAttributeLabel(row, locale)}>
                <span className="truncate font-medium">
                  {getAttributeLabel(row, locale)}
                  {row.type === "RANGE" && row.unit && (
                    <span className="ml-1.5 text-xs text-muted-foreground">
                      ({row.unit})
                    </span>
                  )}
                </span>
              </TruncatedTooltip>

              {/* Key */}
              <span className="font-mono text-xs text-muted-foreground truncate">
                {row.key}
              </span>

              {/* Type */}
              <div className="flex justify-center">
                <Badge variant="secondary" className="text-xs">
                  {t(`type_${row.type}`)}
                </Badge>
              </div>

              {/* Usage: categories assigned · options count */}
              <div className="text-right text-sm tabular-nums text-muted-foreground">
                {t("usageSummary", {
                  categories: row._count.categories,
                  options: row._count.options,
                })}
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={isNavigating && editingId === row.id}
                  onClick={() => {
                    setEditingId(row.id);
                    startNavigate(() =>
                      router.push(`/${locale}/admin/attributes/${row.id}/edit`),
                    );
                  }}
                >
                  {isNavigating && editingId === row.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Pencil className="h-4 w-4" />
                  )}
                  <span className="sr-only">{t("edit")}</span>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={isDuplicating && duplicatingId === row.id}
                  onClick={() => handleDuplicate(row.id)}
                  title={t("duplicate")}
                >
                  {isDuplicating && duplicatingId === row.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                  <span className="sr-only">{t("duplicate")}</span>
                </Button>
                <ActionButton
                  open={deleteOpenId === row.id}
                  onOpenChange={(next) => setDeleteOpenId(next ? row.id : null)}
                  title={t("deleteConfirm", {
                    name: getAttributeLabel(row, locale),
                  })}
                  // Category assignments do not block the delete (they are
                  // configuration, and cost nothing to redo) - they are just
                  // worth saying out loud before it goes.
                  description={
                    row._count.categories > 0
                      ? t("deleteFromCategories", { count: row._count.categories })
                      : t("deleteDesc")
                  }
                  blockedReason={
                    row._count.values + row._count.variantValues > 0
                      ? t("deleteInUse", {
                          count: row._count.values + row._count.variantValues,
                        })
                      : undefined
                  }
                  confirmText={t("delete")}
                  loadingText={t("deleting")}
                  isLoading={isPending && deletingId === row.id}
                  onConfirm={() => handleDelete(row.id)}
                >
                  {/* Resting control - the dialog's confirm button carries the
                      spinner. */}
                  <Button variant="ghost" size="icon">
                    <Trash2 className="h-4 w-4 text-destructive" />
                    <span className="sr-only">{t("delete")}</span>
                  </Button>
                </ActionButton>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
