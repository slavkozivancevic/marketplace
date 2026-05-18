"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import {
  Loader2,
  Pencil,
  Trash2,
  ChevronRight,
  FolderOpen,
  Folder,
  Star,
} from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { SearchInput } from "@/components/search/SearchInput";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { deleteCategoryAction } from "../actions/categories";
import type { CategoryListItem } from "../db/categories";
import { getCategoryName } from "../utils/translations";
import { useLocale } from "next-intl";
import { cn } from "@/lib/utils";

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
  const [deleteOpenId, setDeleteOpenId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isNavigating, startNavigate] = useTransition();

  // Close the open dialog once its delete settles.
  const wasPending = useRef(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (wasPending.current && !isPending) setDeleteOpenId(null);
    wasPending.current = isPending;
  }, [isPending]);

  const treeRows = useMemo(() => toTreeOrder(categories), [categories]);

  const filtered = useMemo(() => {
    if (!search) return treeRows;
    const q = search.toLowerCase();
    return treeRows.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.slug.toLowerCase().includes(q) ||
        (c.translations?.sr?.name ?? "").toLowerCase().includes(q),
    );
  }, [treeRows, search]);

  const handleDelete = (id: string) => {
    setDeletingId(id);
    startTransition(async () => {
      const result = await deleteCategoryAction(id);
      if (result && "error" in result) {
        toast.error(result.message);
      } else {
        toast.success(t("deleted"));
      }
      setDeletingId(null);
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
            (isPending || isNavigating) &&
              "opacity-60 pointer-events-none transition-opacity duration-150",
          )}
        >
          {/* Header */}
          <div className="grid items-center gap-3 border-b p-3 text-xs font-medium text-muted-foreground bg-background sticky top-0 z-10"
            style={{ gridTemplateColumns: "1fr 140px 90px 70px 80px" }}>
            <div>{t("name")}</div>
            <div>{t("slug")}</div>
            <div className="text-center">{t("products")}</div>
            <div className="text-center">{t("status")}</div>
            <div />
          </div>

          {filtered.map((row) => {
            const isRoot = row.depth === 0;
            return (
              <div
                key={row.id}
                className={cn(
                  "grid items-center gap-3 border-b p-3",
                  isRoot && "bg-muted/20",
                )}
                style={{ gridTemplateColumns: "1fr 140px 90px 70px 80px" }}
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
                  <span
                    className={cn(
                      "truncate",
                      isRoot ? "font-semibold" : "text-sm",
                    )}
                  >
                    {getCategoryName(row, locale)}
                  </span>
                  {row.isFeatured && (
                    <Star className="h-3.5 w-3.5 text-amber-400 fill-amber-400 shrink-0" />
                  )}
                  {row._count.children > 0 && (
                    <span className="text-xs text-muted-foreground shrink-0">
                      ({row._count.children})
                    </span>
                  )}
                </div>

                {/* Slug */}
                <div className="font-mono text-xs text-muted-foreground truncate">
                  {row.slug}
                </div>

                {/* Products */}
                <div className="text-sm text-center tabular-nums">
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
                      startNavigate(() => router.push(`/admin/categories/${row.id}/edit`));
                    }}
                  >
                    {isNavigating && editingId === row.id
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : <Pencil className="h-4 w-4" />}
                    <span className="sr-only">{t("edit")}</span>
                  </Button>
                  <AlertDialog
                    open={deleteOpenId === row.id}
                    onOpenChange={(next) => {
                      const rowBusy = isPending && deletingId === row.id;
                      if (rowBusy) return;
                      setDeleteOpenId(next ? row.id : null);
                    }}
                  >
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={isPending && deletingId === row.id}
                      >
                        {isPending && deletingId === row.id
                          ? <Loader2 className="h-4 w-4 animate-spin text-destructive" />
                          : <Trash2 className="h-4 w-4 text-destructive" />}
                        <span className="sr-only">{t("delete")}</span>
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          {t("deleteConfirm", { name: getCategoryName(row, locale) })}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          {row._count.children > 0
                            ? t("deleteHasChildren", { count: row._count.children })
                            : t("deleteDesc")}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel disabled={isPending && deletingId === row.id}>
                          {t("cancel")}
                        </AlertDialogCancel>
                        <AlertDialogAction
                          onClick={(e) => {
                            e.preventDefault();
                            handleDelete(row.id);
                          }}
                          disabled={isPending && deletingId === row.id}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          {isPending && deletingId === row.id ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              {t("deleting")}
                            </>
                          ) : (
                            t("delete")
                          )}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}