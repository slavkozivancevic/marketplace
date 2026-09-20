"use client";

import { useMemo, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Copy, Loader2, Pencil, Trash2 } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { useAnnounceWhenSettled } from "@/lib/hooks/useAnnounceWhenSettled";
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
import { TAG_COLS } from "./TagTableSkeleton";

// Column layout (name | slug | products | actions) is owned by the skeleton
// module so the two can never drift.
const COLS = TAG_COLS;

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
  deleteOpen,
  onDeleteOpenChange,
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
  /**
   * Owned by the page, not the row, so the page can steer it from inside the
   * delete transition. On success it is never closed by hand: the refreshed list
   * drops the row and this dialog, which lives inside it, goes with it - in the
   * same frame the spinner stops and the toast appears. On failure it stays open
   * with the reason.
   */
  deleteOpen: boolean;
  onDeleteOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations();

  return (
    <div
      role="row"
      className="grid items-center gap-4 border-b p-3 min-w-fit"
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
              onDeleteOpenChange(next);
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
  const [deleteOpenId, setDeleteOpenId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isNavigating, startNavigate] = useTransition();
  const [isDuplicating, startDuplicate] = useTransition();
  // Toasts wait for the refreshed list, so they land with the row they describe.
  const announceDeleted = useAnnounceWhenSettled(isPending);
  const announceDuplicated = useAnnounceWhenSettled(isDuplicating);

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
        // Leave the dialog open so the reason stays readable, and re-arm the
        // confirm button for a retry.
        toast.error(result.message);
        setDeletingId(null);
        return;
      }
      // Neither the dialog nor the toast is touched here: the row still exists on
      // screen, and closing or announcing now would confirm a deletion the user
      // can still see. `router.refresh()` inside the transition keeps `isPending`
      // (and with it the confirm button's spinner) alive until the refreshed list
      // commits - the frame in which the row disappears and the dialog, which
      // lives inside that row, goes with it. The queued toast fires in that same
      // frame. `deletingId` is deliberately not cleared, as before.
      announceDeleted({ message: t("tags.tagDeleted") });
      router.refresh();
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
      if (!("id" in result)) {
        toast.error(result.message);
        setDuplicatingId(null);
        return;
      }
      const copyId = result.id;
      // The copy exists on the server; the list still doesn't show it. Announce
      // it when it does - the spinner runs until then, for the same reason.
      announceDuplicated({
        message: t("tags.duplicated"),
        action: {
          label: t("tags.editCopy"),
          onClick: () => router.push(`/${locale}/admin/tags/${copyId}/edit`),
        },
      });
      router.refresh();
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
              deleteOpen={deleteOpenId === tg.id}
              onDeleteOpenChange={(open) => setDeleteOpenId(open ? tg.id : null)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
