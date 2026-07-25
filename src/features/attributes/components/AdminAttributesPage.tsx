"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Copy, Loader2, Pencil, Trash2 } from "lucide-react";
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
import {
  deleteAttributeAction,
  duplicateAttributeAction,
} from "../actions/attributes";
import type { AttributeListItem } from "../db/attributes";
import { getAttributeLabel } from "../utils/translations";
import { cn } from "@/lib/utils";
import { TruncatedTooltip } from "@/components/TruncatedTooltip";

const GRID = "1fr 130px 80px 90px 116px";

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

  const wasPending = useRef(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (wasPending.current && !isPending) setDeleteOpenId(null);
    wasPending.current = isPending;
  }, [isPending]);

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
      if (result && "error" in result) toast.error(result.message);
      else toast.success(t("deleted"));
      setDeletingId(null);
    });
  };

  const handleDuplicate = (id: string) => {
    setDuplicatingId(id);
    startDuplicate(async () => {
      const result = await duplicateAttributeAction(id);
      if ("id" in result) {
        toast.success(t("duplicated"), {
          action: {
            label: t("editCopy"),
            onClick: () =>
              router.push(`/${locale}/admin/attributes/${result.id}/edit`),
          },
        });
      } else {
        toast.error(result.message);
      }
      setDuplicatingId(null);
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
            className="grid items-center gap-3 border-b p-3 text-xs font-medium text-muted-foreground bg-background sticky top-0 z-10"
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
              className="grid items-center gap-3 border-b p-3"
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
                <AlertDialog
                  open={deleteOpenId === row.id}
                  onOpenChange={(next) => {
                    if (isPending && deletingId === row.id) return;
                    setDeleteOpenId(next ? row.id : null);
                  }}
                >
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={isPending && deletingId === row.id}
                    >
                      {isPending && deletingId === row.id ? (
                        <Loader2 className="h-4 w-4 animate-spin text-destructive" />
                      ) : (
                        <Trash2 className="h-4 w-4 text-destructive" />
                      )}
                      <span className="sr-only">{t("delete")}</span>
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        {t("deleteConfirm", {
                          name: getAttributeLabel(row, locale),
                        })}
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        {row._count.categories > 0 || row._count.values > 0
                          ? t("deleteInUse", {
                              categories: row._count.categories,
                              products: row._count.values,
                            })
                          : t("deleteDesc")}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel
                        disabled={isPending && deletingId === row.id}
                      >
                        {t("cancel")}
                      </AlertDialogCancel>
                      <AlertDialogAction
                        onClick={(e) => {
                          e.preventDefault();
                          handleDelete(row.id);
                        }}
                        disabled={isPending && deletingId === row.id}
                        variant="destructiveSolid"
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
          ))}
        </div>
      )}
    </div>
  );
}
