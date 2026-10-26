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
import { countryName, foldForSearch } from "@/lib/i18n/countries";
import { deletePriceMarketAction, duplicatePriceMarketAction } from "../actions/priceMarkets";
import type { PriceMarketListItem } from "../db/markets";
import { getPriceMarketName } from "../utils/markets";
import { PRICE_MARKET_COLS } from "./PriceMarketTableSkeleton";
import { priceMarketShapeKey, type PriceMarketFormShape } from "./PriceMarketFormSkeleton";
import { setRouteShape } from "@/lib/navigation/routeShape";
import { TableScroll } from "@/components/ui/table-scroll";
import { IconButton } from "@/components/IconButton";

const COLS = PRICE_MARKET_COLS;

function Header() {
  const t = useTranslations("priceMarkets");
  return (
    <div
      role="row"
      className="grid items-center gap-4 border-b p-3 text-sm font-medium text-muted-foreground bg-background rounded-t-lg sticky top-0 z-10 min-w-fit"
      style={{ gridTemplateColumns: COLS }}
    >
      <div role="columnheader">{t("name")}</div>
      <div role="columnheader">{t("countries")}</div>
      <div role="columnheader" className="text-right">{t("rules")}</div>
      <div role="columnheader" className="text-right pr-2.5">{t("actions")}</div>
    </div>
  );
}

type Row = { market: PriceMarketListItem; name: string; countryNames: string[] };

function MarketRow({
  row,
  onDelete,
  onEdit,
  onDuplicate,
  isDeleting,
  isEditing,
  isDuplicating,
  deleteOpen,
  onDeleteOpenChange,
}: {
  row: Row;
  onDelete: (id: string) => void;
  onEdit: (id: string) => void;
  onDuplicate: (id: string) => void;
  isDeleting: boolean;
  isEditing: boolean;
  isDuplicating: boolean;
  /** Owned by the page: success unmounts the row and its dialog, failure keeps it open. */
  deleteOpen: boolean;
  onDeleteOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("priceMarkets");
  const tCommon = useTranslations("common");
  const tProducts = useTranslations("products");
  const { market, name, countryNames } = row;

  // Told before the click, the same condition the db layer refuses on.
  const blockedReason = market.isDefault
    ? t("deleteBlockedDefault")
    : market.ruleCount > 0
      ? t("deleteBlockedInUse", { count: market.ruleCount })
      : undefined;
  const countries = market.isDefault ? t("defaultCountries") : countryNames.join(", ") || t("noCountries");

  return (
    <div role="row" className="grid items-center gap-4 border-b p-3 min-w-fit" style={{ gridTemplateColumns: COLS }}>
      {/* The default flag sits beside the name, like the featured star on
          categories: a market has no active/inactive state, so there is no
          status column for it to go in. */}
      <div role="cell" className="flex min-w-0 items-center gap-2">
        <TruncatedTooltip content={name}>
          <span className="font-medium truncate">{name}</span>
        </TruncatedTooltip>
        {market.isDefault && (
          <Badge variant="secondary" className="shrink-0">
            {t("default")}
          </Badge>
        )}
      </div>
      <TruncatedTooltip content={countries}>
        <div role="cell" className="truncate text-sm text-muted-foreground">{countries}</div>
      </TruncatedTooltip>
      <div role="cell" className="text-right tabular-nums text-sm">{market.ruleCount}</div>
      <div role="cell" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-end gap-1">
          <IconButton label={tCommon("edit")} variant="ghost" size="icon" disabled={isEditing} onClick={() => onEdit(market.id)}>
            {isEditing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />}
          </IconButton>
          <IconButton
            label={t("duplicate")}
            variant="ghost"
            size="icon"
            disabled={isDuplicating}
            onClick={() => onDuplicate(market.id)}
          >
            {isDuplicating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
          </IconButton>
          <ActionButton
            open={deleteOpen}
            onOpenChange={onDeleteOpenChange}
            title={t("deleteConfirm", { name })}
            description={t("deleteDesc")}
            blockedReason={blockedReason}
            confirmText={tCommon("delete")}
            loadingText={tProducts("deleting")}
            isLoading={isDeleting}
            onConfirm={() => onDelete(market.id)}
          >
            {/* Resting control - the dialog's confirm button carries the spinner. */}
            <IconButton label={tCommon("delete")} variant="ghost" size="icon">
              <Trash2 className="h-4 w-4 text-destructive" />
            </IconButton>
          </ActionButton>
        </div>
      </div>
    </div>
  );
}

export function AdminPriceMarketsPage({ markets }: { markets: PriceMarketListItem[] }) {
  const t = useTranslations("priceMarkets");
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
  // The toasts wait for the refreshed list, so they land with the row they describe.
  const announceDeleted = useAnnounceWhenSettled(isPending);
  const announceDuplicated = useAnnounceWhenSettled(isDuplicating);

  const rows = useMemo<Row[]>(
    () =>
      markets.map((m) => ({
        market: m,
        name: getPriceMarketName(m, locale),
        countryNames: m.countries.map((c) => countryName(c, locale)),
      })),
    [markets, locale],
  );

  const filtered = useMemo(() => {
    const q = foldForSearch(search.trim());
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.market.translations.some((tr) => foldForSearch(tr.name).includes(q)) ||
        r.market.countries.some((c) => c.toLowerCase() === q) ||
        r.countryNames.some((n) => foldForSearch(n).includes(q)),
    );
  }, [rows, search]);

  const handleDelete = (id: string) => {
    setDeletingId(id);
    startTransition(async () => {
      const result = await deletePriceMarketAction(id);
      if (result && "error" in result) {
        // The dialog stays open with the reason beside it; re-arm for a retry.
        toast.error(result.message);
        setDeletingId(null);
        return;
      }
      announceDeleted({ message: t("deleted") });
      router.refresh();
    });
  };

  const handleEdit = (id: string) => {
    setEditingId(id);
    // The edit skeleton draws this market's country chips, which wrap by name.
    const market = markets.find((m) => m.id === id);
    if (market) {
      const shape: PriceMarketFormShape = { isDefault: market.isDefault, countries: market.countries };
      setRouteShape(priceMarketShapeKey(id), shape);
    }
    startNavigate(() => router.push(`/${locale}/admin/price-markets/${id}/edit`));
  };

  const handleDuplicate = (id: string) => {
    setDuplicatingId(id);
    startDuplicate(async () => {
      const result = await duplicatePriceMarketAction(id);
      if (!("id" in result)) {
        toast.error(result.message);
        setDuplicatingId(null);
        return;
      }
      const copyId = result.id;
      // The copy has no countries yet, so the toast says so and offers the way
      // straight to them. Raised once the refreshed list shows the copy.
      announceDuplicated({
        message: t("duplicated"),
        action: {
          label: t("editCopy"),
          onClick: () => {
            // A copy is never the default and starts with no countries.
            const shape: PriceMarketFormShape = { isDefault: false, countries: [] };
            setRouteShape(priceMarketShapeKey(copyId), shape);
            router.push(`/${locale}/admin/price-markets/${copyId}/edit`);
          },
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
          {t("count", { count: filtered.length })}
        </span>
      </div>

      {filtered.length === 0 ? (
        <Alert>
          <AlertTitle>{t("noneFound")}</AlertTitle>
          <AlertDescription>{t("adjustSearch")}</AlertDescription>
        </Alert>
      ) : (
        <TableScroll locked={isPending || isNavigating || isDuplicating}>
          <Header />
          {filtered.map((row) => (
            <MarketRow
              key={row.market.id}
              row={row}
              onDelete={handleDelete}
              onEdit={handleEdit}
              onDuplicate={handleDuplicate}
              isDeleting={isPending && deletingId === row.market.id}
              isEditing={isNavigating && editingId === row.market.id}
              isDuplicating={isDuplicating && duplicatingId === row.market.id}
              deleteOpen={deleteOpenId === row.market.id}
              onDeleteOpenChange={(open) => setDeleteOpenId(open ? row.market.id : null)}
            />
          ))}
        </TableScroll>
      )}
    </div>
  );
}
