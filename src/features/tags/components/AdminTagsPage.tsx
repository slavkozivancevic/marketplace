"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Copy, Loader2, Pencil, Trash2 } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import { TruncatedTooltip } from "@/components/TruncatedTooltip";
import { SearchInput } from "@/components/search/SearchInput";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
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
import { deleteTagAction, duplicateTagAction } from "../actions/tags";
import type { TagListItem } from "../db/tags";
import { getTagName, getTagSlug } from "../utils/translations";

// Column layout: name | slug | products | actions
const COLS = "minmax(120px,1fr) 160px 90px 116px";

function TagTableHeader() {
  const t = useTranslations();
  return (
    <div
      role="row"
      className="grid items-center gap-4 border-b p-3 text-sm font-medium text-muted-foreground bg-background rounded-t-lg sticky top-0 z-10 min-w-fit"
      style={{ gridTemplateColumns: COLS }}
    >
      <div role="columnheader">{t("tags.name")}</div>
      <div role="columnheader">{t("tags.slug")}</div>
      <div role="columnheader" className="text-right">{t("tags.products")}</div>
      <div role="columnheader" className="text-right pr-2.5">{t("tags.actions")}</div>
    </div>
  );
}

function TagTableRow({
  tag,
  displayName,
  displaySlug,
  onDelete,
  onEdit,
  onDuplicate,
  isDeleting,
  isEditing,
  isDuplicating,
}: {
  tag: TagListItem;
  displayName: string;
  displaySlug: string;
  onDelete: (id: string) => void;
  onEdit: (id: string) => void;
  onDuplicate: (id: string) => void;
  isDeleting: boolean;
  isEditing: boolean;
  isDuplicating: boolean;
}) {
  const t = useTranslations();
  const [deleteOpen, setDeleteOpen] = useState(false);

  // Close the dialog once the delete that we started actually settles.
  const wasDeleting = useRef(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (wasDeleting.current && !isDeleting) setDeleteOpen(false);
    wasDeleting.current = isDeleting;
  }, [isDeleting]);

  return (
    <div
      role="row"
      className="grid items-center gap-4 border-b p-3 hover:bg-muted/50 transition-colors min-w-fit"
      style={{ gridTemplateColumns: COLS }}
    >
      <TruncatedTooltip content={displayName}>
        <div role="cell" className="font-medium truncate">{displayName}</div>
      </TruncatedTooltip>
      <div role="cell" className="text-muted-foreground font-mono text-xs truncate">
        {displaySlug}
      </div>
      <div role="cell" className="text-right tabular-nums text-sm">{tag._count.products}</div>
      <div role="cell" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            disabled={isEditing}
            onClick={() => onEdit(tag.id)}
          >
            {isEditing
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <Pencil className="h-4 w-4" />}
            <span className="sr-only">Edit</span>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            disabled={isDuplicating}
            onClick={() => onDuplicate(tag.id)}
            title={t("tags.duplicate")}
          >
            {isDuplicating
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <Copy className="h-4 w-4" />}
            <span className="sr-only">{t("tags.duplicate")}</span>
          </Button>
          <AlertDialog
            open={deleteOpen}
            onOpenChange={(next) => {
              if (isDeleting) return;
              setDeleteOpen(next);
            }}
          >
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" disabled={isDeleting}>
                {isDeleting
                  ? <Loader2 className="h-4 w-4 animate-spin text-destructive" />
                  : <Trash2 className="h-4 w-4 text-destructive" />}
                <span className="sr-only">Delete</span>
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t("tags.deleteConfirm", { name: displayName })}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t("tags.deleteDesc")}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isDeleting}>{t("common.cancel")}</AlertDialogCancel>
                <AlertDialogAction
                  onClick={(e) => {
                    e.preventDefault();
                    onDelete(tag.id);
                  }}
                  disabled={isDeleting}
                  variant="destructiveSolid"
                >
                  {isDeleting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {t("products.deleting")}
                    </>
                  ) : (
                    t("common.delete")
                  )}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
}

export function AdminTagsPage({ tags }: { tags: TagListItem[] }) {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isNavigating, startNavigate] = useTransition();
  const [isDuplicating, startDuplicate] = useTransition();

  const localizedTags = useMemo(
    () =>
      tags.map((tg) => ({
        tag: tg,
        displayName: getTagName(tg, locale),
        displaySlug: getTagSlug(tg, locale),
      })),
    [tags, locale],
  );

  const filtered = useMemo(() => {
    if (!search) return localizedTags;
    const q = search.toLowerCase();
    return localizedTags.filter(
      ({ tag: tg, displayName }) =>
        displayName.toLowerCase().includes(q) ||
        // Match against any locale's name / slug so admins can paste a
        // snippet from any language and still hit a tag.
        tg.translations.some(
          (tr) =>
            tr.name.toLowerCase().includes(q) ||
            tr.slug.toLowerCase().includes(q),
        ),
    );
  }, [localizedTags, search]);

  const handleDelete = (id: string) => {
    setDeletingId(id);
    startTransition(async () => {
      const result = await deleteTagAction(id);
      if (result && "error" in result) {
        toast.error(result.message);
      } else {
        toast.success(t("tags.tagDeleted"));
      }
      setDeletingId(null);
    });
  };

  const handleEdit = (id: string) => {
    setEditingId(id);
    startNavigate(() => router.push(`/${locale}/admin/tags/${id}/edit`));
  };

  const handleDuplicate = (id: string) => {
    setDuplicatingId(id);
    startDuplicate(async () => {
      const result = await duplicateTagAction(id);
      if ("id" in result) {
        toast.success(t("tags.duplicated"), {
          action: {
            label: t("tags.editCopy"),
            onClick: () => router.push(`/${locale}/admin/tags/${result.id}/edit`),
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
        <SearchInput value={search} onChange={setSearch} placeholder={t("tags.searchPlaceholder")} />
        <span className="text-xs text-muted-foreground ml-auto tabular-nums">
          {filtered.length.toLocaleString()} {filtered.length !== 1 ? t("tags.tags") : t("tags.tag")}
        </span>
      </div>

      {filtered.length === 0 ? (
        <Alert>
          <AlertTitle>{search ? t("tags.noTagsFound") : t("tags.noTags")}</AlertTitle>
          <AlertDescription>
            {search ? t("tags.adjustSearch") : t("tags.createFirst")}
          </AlertDescription>
        </Alert>
      ) : (
        <div
          role="table"
          className={cn(
            "rounded-lg border flex-1 min-h-0 overflow-auto [scrollbar-gutter:stable]",
            (isPending || isNavigating || isDuplicating) &&
              "opacity-60 pointer-events-none transition-opacity duration-150",
          )}
        >
          <TagTableHeader />
          {filtered.map(({ tag: tg, displayName, displaySlug }) => (
            <TagTableRow
              key={tg.id}
              tag={tg}
              displayName={displayName}
              displaySlug={displaySlug}
              onDelete={handleDelete}
              onEdit={handleEdit}
              onDuplicate={handleDuplicate}
              isDeleting={isPending && deletingId === tg.id}
              isEditing={isNavigating && editingId === tg.id}
              isDuplicating={isDuplicating && duplicatingId === tg.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}
