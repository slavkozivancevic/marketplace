"use client";

import { useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import Image from "next/image";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "@/components/ui/sonner";
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
import { deleteBrandAction } from "../actions/brands";
import type { BrandListItem } from "../db/brands";

// Column layout: logo | name | slug | description | products | actions
const COLS = "48px minmax(120px,1fr) 140px minmax(120px,2fr) 80px 80px";

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
      <div role="columnheader" />
    </div>
  );
}

function BrandTableRow({
  brand,
  onDelete,
  isDeleting,
}: {
  brand: BrandListItem;
  onDelete: (id: string) => void;
  isDeleting: boolean;
}) {
  const t = useTranslations();
  return (
    <div
      role="row"
      className="grid items-center gap-4 border-b p-3 hover:bg-muted/50 transition-colors min-w-fit"
      style={{ gridTemplateColumns: COLS }}
    >
      <div role="cell">
        {brand.logoUrl ? (
          <div className="relative h-10 w-10 overflow-hidden rounded border bg-muted shrink-0">
            <Image
              src={brand.logoUrl}
              alt={brand.name}
              fill
              sizes="40px"
              className="object-contain"
            />
          </div>
        ) : (
          <div className="h-10 w-10 rounded border bg-muted flex items-center justify-center text-xs text-muted-foreground font-medium">
            {brand.name.slice(0, 2).toUpperCase()}
          </div>
        )}
      </div>
      <div role="cell" className="font-medium truncate">{brand.name}</div>
      <div role="cell" className="text-muted-foreground font-mono text-xs truncate">{brand.slug}</div>
      <div role="cell" className="text-muted-foreground text-sm truncate">{brand.description ?? "—"}</div>
      <div role="cell" className="text-right tabular-nums text-sm">{brand._count.products}</div>
      <div role="cell" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-end gap-1">
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/admin/brands/${brand.id}/edit`}>
              <Pencil className="h-4 w-4" />
              <span className="sr-only">Edit</span>
            </Link>
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" disabled={isDeleting}>
                <Trash2 className="h-4 w-4 text-destructive" />
                <span className="sr-only">Delete</span>
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t("brands.deleteConfirm", { name: brand.name })}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t("brands.deleteDesc")}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => onDelete(brand.id)}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {t("common.delete")}
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
  const [search, setSearch] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    if (!search) return brands;
    const q = search.toLowerCase();
    return brands.filter(
      (b) =>
        b.name.toLowerCase().includes(q) ||
        b.slug.toLowerCase().includes(q) ||
        b.description?.toLowerCase().includes(q),
    );
  }, [brands, search]);

  const handleDelete = (id: string) => {
    setDeletingId(id);
    startTransition(async () => {
      const result = await deleteBrandAction(id);
      if (result && "error" in result) {
        toast.error(result.message);
      } else {
        toast.success(t("brands.brandDeleted"));
      }
      setDeletingId(null);
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
        <div role="table" className="rounded-lg border flex-1 min-h-0 overflow-auto">
          <BrandTableHeader />
          {filtered.map((brand) => (
            <BrandTableRow
              key={brand.id}
              brand={brand}
              onDelete={handleDelete}
              isDeleting={isPending && deletingId === brand.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}