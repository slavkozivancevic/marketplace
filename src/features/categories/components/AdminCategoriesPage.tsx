"use client";

import { useMemo, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import {
  Copy,
  Loader2,
  Pencil,
  Trash2,
  ChevronRight,
  FolderOpen,
  Folder,
  Star,
} from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { useAnnounceWhenSettled } from "@/lib/hooks/useAnnounceWhenSettled";
import { SearchInput } from "@/components/search/SearchInput";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ActionButton } from "@/components/ActionButton";
import { deleteCategoryAction, duplicateCategoryAction } from "../actions/categories";
import type { CategoryListItem } from "../db/categories";
import { getCategoryName } from "../utils/translations";
import { cn } from "@/lib/utils";
import { TruncatedTooltip } from "@/components/TruncatedTooltip";
import { CATEGORY_COLS } from "./CategoryTableSkeleton";

// Column layout (name | slug | products | status | actions) is owned by the
// skeleton module so the two can never drift. Name carries a depth indent plus
// icons/badges on top of the text, so it needs an explicit floor like every
// other table's `minmax(Npx,1fr)` - a bare `1fr` can collapse toward 0
// alongside the container's `min-w-fit`, letting the row's icons/text visually
// spill past the column edge into the Slug column instead of being clipped.
const COLS = CATEGORY_COLS;

/** Sort flat list into tree order: root → its children → next root → its children */
function toTreeOrder(categories: CategoryListItem[]): Array<CategoryListItem & { depth: number }> {
  const roots = categories.filter((c) => !c.parentId);
  const byParent = new Map<string, CategoryListItem[]>();
  for (const c of categories) {
    if (c.parentId) {
      const arr = byParent.get(c.parentId) ?? [];
      arr.push(c);
      byParent.set(c.parentId, arr);
    }
  }

  const result: Array<CategoryListItem & { depth: number }> = [];

  function walk(node: CategoryListItem, depth: number) {
    result.push({ ...node, depth });
    const children = byParent.get(node.id) ?? [];
    for (const child of children) walk(child, depth + 1);
  }

  for (const root of roots) walk(root, 0);

  // Append orphaned nodes (edge case)
  const ids = new Set(result.map((r) => r.id));
  for (const c of categories) {
    if (!ids.has(c.id)) result.push({ ...c, depth: 1 });
  }

  return result;
}

export function AdminCategoriesPage({
  categories,
}: {
  categories: CategoryListItem[];
}) {
  const t = useTranslations("adminCategories");
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

  const treeRows = useMemo(() => toTreeOrder(categories), [categories]);

  const filtered = useMemo(() => {
    if (!search) return treeRows;
    const q = search.toLowerCase();
    // Match against any locale's name or slug so admins can paste a snippet
    // from any UI language and still hit the right category.
    return treeRows.filter((c) =>
      c.translations.some(
        (tr) =>
          tr.name.toLowerCase().includes(q) ||
          tr.slug.toLowerCase().includes(q),
      ),
    );
  }, [treeRows, search]);

  const handleDelete = (id: string) => {
    setDeletingId(id);
    startTransition(async () => {
      const result = await deleteCategoryAction(id);
      if (result && "error" in result) {
        // Leave the dialog open so the reason stays readable, and re-arm the
        // confirm button for a retry.
        toast.error(result.message);
        setDeletingId(null);
        return;
      }
      // Announced when the refreshed list actually drops the row - see the note
      // in AdminTagsPage. The dialog lives inside that row and goes with it, so
      // the spinner, the popup and the toast all resolve in one frame.
      announceDeleted({ message: t("deleted") });
      router.refresh();
    });
  };

  const handleDuplicate = (id: string) => {
    setDuplicatingId(id);
    startDuplicate(async () => {
      const result = await duplicateCategoryAction(id);
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
          onClick: () => router.push(`/${locale}/admin/categories/${copyId}/edit`),
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
          {categories.length} {t("total")}
        </span>
      </div>

      {filtered.length === 0 ? (
        <Alert>
          <AlertTitle>
            {search ? t("noneFound") : t("none")}
          </AlertTitle>
          <AlertDescription>
            {search ? t("adjustSearch") : t("createFirst")}
          </AlertDescription>
        </Alert>
      ) : (
        <div
          className={cn(
            "rounded-lg border flex-1 min-h-0 overflow-auto",
            // Lock the whole table while any row's action is in flight, so
            // the user can't start a second action on a different row.
            (isPending || isNavigating || isDuplicating) &&
              "opacity-60 pointer-events-none transition-opacity duration-150",
          )}
        >
          {/* Header */}
          <div className="grid items-center gap-3 border-b p-3 text-xs font-medium text-muted-foreground bg-background sticky top-0 z-10 min-w-fit"
            style={{ gridTemplateColumns: COLS }}>
            <div>{t("name")}</div>
            <div>{t("slug")}</div>
            <div className="text-right">{t("products")}</div>
            <div className="text-center">{t("status")}</div>
            {/* pr-2.5 (10px) matches the trash icon's visible right edge -
                36px icon Button with 16px glyph leaves 10px on each side. */}
            <div className="text-right pr-2.5">{t("actions")}</div>
          </div>

          {filtered.map((row) => {
            const isRoot = row.depth === 0;
            return (
              <div
                key={row.id}
                className={cn(
                  "grid items-center gap-3 border-b p-3 min-w-fit",
                  isRoot && "bg-muted/20",
                )}
                style={{ gridTemplateColumns: COLS }}
              >
                {/* Name */}
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className="shrink-0"
                    style={{ width: `${row.depth * 20}px` }}
                  />
                  {row.depth > 0 && (
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  )}
                  {isRoot ? (
                    <FolderOpen className="h-4 w-4 text-amber-500 shrink-0" />
                  ) : (
                    <Folder className="h-4 w-4 text-muted-foreground/60 shrink-0" />
                  )}
                  <TruncatedTooltip content={getCategoryName(row, locale)}>
                    <span
                      className={cn(
                        "truncate",
                        isRoot ? "font-semibold" : "text-sm",
                      )}
                    >
                      {getCategoryName(row, locale)}
                    </span>
                  </TruncatedTooltip>
                  {row.isFeatured && (
                    <Star className="h-3.5 w-3.5 text-amber-400 fill-amber-400 shrink-0" />
                  )}
                  {row._count.children > 0 && (
                    <span className="text-xs text-muted-foreground shrink-0">
                      ({row._count.children})
                    </span>
                  )}
                </div>

                {/* Slug - show the active locale's slug (defaults to en) */}
                <div className="font-mono text-xs text-muted-foreground truncate">
                  {row.translations.find((tr) => tr.locale === locale)?.slug ??
                    row.translations.find((tr) => tr.locale === "en")?.slug ??
                    ""}
                </div>

                {/* Products */}
                <div className="text-sm text-right tabular-nums">
                  {row._count.products}
                </div>

                {/* Status */}
                <div className="flex justify-center">
                  <Badge
                    variant={row.isActive ? "default" : "secondary"}
                    className="text-xs"
                  >
                    {row.isActive ? t("active") : t("inactive")}
                  </Badge>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={isNavigating && editingId === row.id}
                    onClick={() => {
                      setEditingId(row.id);
                      startNavigate(() => router.push(`/${locale}/admin/categories/${row.id}/edit`));
                    }}
                  >
                    {isNavigating && editingId === row.id
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : <Pencil className="h-4 w-4" />}
                    <span className="sr-only">{t("edit")}</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={isDuplicating && duplicatingId === row.id}
                    onClick={() => handleDuplicate(row.id)}
                    title={t("duplicate")}
                  >
                    {isDuplicating && duplicatingId === row.id
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : <Copy className="h-4 w-4" />}
                    <span className="sr-only">{t("duplicate")}</span>
                  </Button>
                  <ActionButton
                    open={deleteOpenId === row.id}
                    onOpenChange={(next) => setDeleteOpenId(next ? row.id : null)}
                    title={t("deleteConfirm", { name: getCategoryName(row, locale) })}
                    description={t("deleteDesc")}
                    // Both of these are refused by deleteCategory() as well -
                    // this only means the admin finds out before clicking,
                    // instead of through an error toast.
                    blockedReason={
                      row._count.children > 0
                        ? t("deleteHasChildren", { count: row._count.children })
                        : row._count.products > 0
                          ? t("deleteHasProducts", { count: row._count.products })
                          : undefined
                    }
                    confirmText={t("delete")}
                    loadingText={t("deleting")}
                    isLoading={isPending && deletingId === row.id}
                    onConfirm={() => handleDelete(row.id)}
                  >
                    {/* Resting control - the dialog's confirm button carries
                        the spinner. */}
                    <Button variant="ghost" size="icon">
                      <Trash2 className="h-4 w-4 text-destructive" />
                      <span className="sr-only">{t("delete")}</span>
                    </Button>
                  </ActionButton>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}