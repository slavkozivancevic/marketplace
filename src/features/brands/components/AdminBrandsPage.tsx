"use client";

import { useMemo, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { BrandLogo } from "@/features/brands/components/BrandLogo";
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
import { deleteBrandAction, duplicateBrandAction } from "../actions/brands";
import type { BrandListItem } from "../db/brands";
import { getBrandDescription, getBrandName, getBrandSlug } from "../utils/translations";
import { BRAND_COLS } from "./BrandTableSkeleton";

// Column layout (logo | name | slug | description | products | actions) is
// owned by the skeleton module so the two can never drift.
const COLS = BRAND_COLS;

function BrandTableHeader() {
  const t = useTranslations();
  return (
    <div
      role="row"
      className="grid items-center gap-4 border-b p-3 text-sm font-medium text-muted-foreground bg-background rounded-t-lg sticky top-0 z-10 min-w-fit"
      style={{ gridTemplateColumns: COLS }}
    >
      <div role="columnheader">{t("brands.logo")}</div>
      <div role="columnheader">{t("brands.name")}</div>
      <div role="columnheader">{t("brands.slug")}</div>
      <div role="columnheader">{t("brands.description")}</div>
      <div role="columnheader" className="text-right">{t("brands.products")}</div>
      {/* pr-2.5 (10px) aligns the label with the trash icon's visible right
          edge - the icon Button is 36px with a 16px glyph, so the rightmost
          icon stops 10px before the cell's right border. */}
      <div role="columnheader" className="text-right pr-2.5">{t("brands.actions")}</div>
    </div>
  );
}

function BrandTableRow({
  brand,
  displayName,
  displaySlug,
  displayDescription,
  onDelete,
  onEdit,
  onDuplicate,
  isDeleting,
  isEditing,
  isDuplicating,
  deleteOpen,
  onDeleteOpenChange,
}: {
  brand: BrandListItem;
  displayName: string;
  displaySlug: string;
  displayDescription: string | null;
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
      <div role="cell">
        <BrandLogo
          src={brand.logoUrl}
          srcDark={brand.logoUrlDark}
          backdrop={brand.logoBackdrop}
          backdropDark={brand.logoBackdropDark}
          name={displayName}
          size={40}
        />
      </div>
      <TruncatedTooltip content={displayName}>
        <div role="cell" className="font-medium truncate">{displayName}</div>
      </TruncatedTooltip>
      <div role="cell" className="text-muted-foreground font-mono text-xs truncate">
        {displaySlug}
      </div>
      <div role="cell" className="text-muted-foreground text-sm truncate">{displayDescription ?? "-"}</div>
      <div role="cell" className="text-right tabular-nums text-sm">{brand._count.products}</div>
      <div role="cell" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            disabled={isEditing}
            onClick={() => onEdit(brand.id)}
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
            onClick={() => onDuplicate(brand.id)}
            title={t("brands.duplicate")}
          >
            {isDuplicating
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <Copy className="h-4 w-4" />}
            <span className="sr-only">{t("brands.duplicate")}</span>
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
                <AlertDialogTitle>{t("brands.deleteConfirm", { name: displayName })}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t("brands.deleteDesc")}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isDeleting}>{t("common.cancel")}</AlertDialogCancel>
                <AlertDialogAction
                  onClick={(e) => {
                    e.preventDefault();
                    onDelete(brand.id);
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

export function AdminBrandsPage({ brands }: { brands: BrandListItem[] }) {
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

  const localizedBrands = useMemo(
    () =>
      brands.map((b) => ({
        brand: b,
        displayName: getBrandName(b, locale),
        displaySlug: getBrandSlug(b, locale),
        displayDescription: getBrandDescription(b, locale),
      })),
    [brands, locale],
  );

  const filtered = useMemo(() => {
    if (!search) return localizedBrands;
    const q = search.toLowerCase();
    return localizedBrands.filter(
      ({ brand: b, displayName, displayDescription }) =>
        displayName.toLowerCase().includes(q) ||
        displayDescription?.toLowerCase().includes(q) ||
        // Match against any locale's name / slug / description so admins
        // can paste a snippet from any language and still hit a brand.
        b.translations.some(
          (tr) =>
            tr.name.toLowerCase().includes(q) ||
            tr.slug.toLowerCase().includes(q) ||
            tr.description?.toLowerCase().includes(q),
        ),
    );
  }, [localizedBrands, search]);

  const handleDelete = (id: string) => {
    setDeletingId(id);
    startTransition(async () => {
      const result = await deleteBrandAction(id);
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
      announceDeleted({ message: t("brands.brandDeleted") });
      router.refresh();
    });
  };

  const handleEdit = (id: string) => {
    setEditingId(id);
    startNavigate(() => router.push(`/${locale}/admin/brands/${id}/edit`));
  };

  const handleDuplicate = (id: string) => {
    setDuplicatingId(id);
    startDuplicate(async () => {
      const result = await duplicateBrandAction(id);
      if (!("id" in result)) {
        toast.error(result.message);
        setDuplicatingId(null);
        return;
      }
      const copyId = result.id;
      // The copy exists on the server; the list still doesn't show it. Announce
      // it when it does - the spinner runs until then, for the same reason.
      announceDuplicated({
        message: t("brands.duplicated"),
        action: {
          label: t("brands.editCopy"),
          onClick: () => router.push(`/${locale}/admin/brands/${copyId}/edit`),
        },
      });
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-4 flex-1 min-h-0">
      <div className="flex flex-wrap items-center gap-3 shrink-0">
        <SearchInput value={search} onChange={setSearch} placeholder={t("brands.searchPlaceholder")} />
        <span className="text-xs text-muted-foreground ml-auto tabular-nums">
          {filtered.length.toLocaleString()} {filtered.length !== 1 ? t("brands.brands") : t("brands.brand")}
        </span>
      </div>

      {filtered.length === 0 ? (
        <Alert>
          <AlertTitle>{search ? t("brands.noBrandsFound") : t("brands.noBrands")}</AlertTitle>
          <AlertDescription>
            {search ? t("brands.adjustSearch") : t("brands.createFirst")}
          </AlertDescription>
        </Alert>
      ) : (
        <div
          role="table"
          className={cn(
            "rounded-lg border flex-1 min-h-0 overflow-auto [scrollbar-gutter:stable]",
            // Lock the whole table while any row's action is in flight, so
            // the user can't start a second action on a different row.
            (isPending || isNavigating || isDuplicating) &&
              "opacity-60 pointer-events-none transition-opacity duration-150",
          )}
        >
          <BrandTableHeader />
          {filtered.map(({ brand, displayName, displaySlug, displayDescription }) => (
            <BrandTableRow
              key={brand.id}
              brand={brand}
              displayName={displayName}
              displaySlug={displaySlug}
              displayDescription={displayDescription}
              onDelete={handleDelete}
              onEdit={handleEdit}
              onDuplicate={handleDuplicate}
              isDeleting={isPending && deletingId === brand.id}
              isEditing={isNavigating && editingId === brand.id}
              isDuplicating={isDuplicating && duplicatingId === brand.id}
              deleteOpen={deleteOpenId === brand.id}
              onDeleteOpenChange={(open) => setDeleteOpenId(open ? brand.id : null)}
            />
          ))}
        </div>
      )}
    </div>
  );
}