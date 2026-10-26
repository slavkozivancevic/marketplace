"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Copy, Loader2, Pencil, Trash2 } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { ActionButton } from "@/components/ActionButton";
import { TableScroll } from "@/components/ui/table-scroll";
import { toast } from "@/components/ui/sonner";
import { useAnnounceWhenSettled } from "@/lib/hooks/useAnnounceWhenSettled";
import { useWhenSettled } from "@/lib/hooks/useWhenSettled";
import { cn } from "@/lib/utils";
import type { MoneySet } from "@/lib/money";
import type { EngineRule } from "../schema/priceRules";
import type { RuleStatus } from "../engine/calendar";
import { deletePriceRule, duplicatePriceRule } from "../actions/priceRules";
import { IconButton } from "@/components/IconButton";
import { PRICE_RULES_GRID } from "./priceRulesGrid";
import { useRuleCellText } from "./useRuleCellText";
import { priceRuleFormShape, priceRuleShapeKey } from "./PriceRuleFormSkeleton";
import { setRouteShape } from "@/lib/navigation/routeShape";

export type RuleRow = EngineRule & { amountMoney: MoneySet | null; status: RuleStatus };

const GRID = PRICE_RULES_GRID;

const STATUS_VARIANT: Record<RuleStatus, "default" | "secondary" | "outline"> = {
  live: "default",
  upcoming: "outline",
  paused: "secondary",
  ended: "secondary",
};

/**
 * The product's rules. Read-only for a viewer who cannot write (no action
 * column); otherwise edit navigates and delete confirms through ActionButton.
 * The deleting row unmounts with the refreshed list and takes its dialog with
 * it, so the spinner, the popup and the toast resolve in one frame. Duplicate
 * makes a PAUSED copy (see duplicateRule) and offers "Edit copy" once it shows.
 */
export function PriceRulesTable({
  rules,
  variantSku,
  marketNames,
  canWrite,
  editPathname,
  productId,
}: {
  rules: RuleRow[];
  variantSku: Record<string, string>;
  /** Market id -> name in the viewer's language, for market rules. */
  marketNames: Record<string, string>;
  canWrite: boolean;
  editPathname: "/dashboard/my-products/[id]/pricing/[ruleId]/edit" | "/admin/products/[id]/pricing/[ruleId]/edit";
  productId: string;
}) {
  const t = useTranslations("priceRules");
  const tc = useTranslations("common");
  const router = useRouter();
  const [pending, setPending] = useState<{ id: string; kind: "duplicate" | "delete" } | null>(null);
  // Edit is a navigation, so its spinner is the navigation's own transition,
  // never stored state: a stored `pending` survives the round trip (the route
  // is kept alive, not remounted) and came back still spinning on return.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteOpenId, setDeleteOpenId] = useState<string | null>(null);
  const [isDeleting, startDelete] = useTransition();
  const [isDuplicating, startDuplicate] = useTransition();
  const [isNavigating, startNavigate] = useTransition();
  const locked = pending !== null || isNavigating;
  // Toasts wait for the refreshed list, so they land with the row they describe.
  const announceDeleted = useAnnounceWhenSettled(isDeleting);
  const announceDuplicated = useAnnounceWhenSettled(isDuplicating);
  const whenDuplicated = useWhenSettled(isDuplicating);
  const whenDeleted = useWhenSettled(isDeleting);

  const { change, schedule } = useRuleCellText(marketNames);

  // Hands the rule's shape to the edit page's skeleton, so it draws this
  // rule's rows instead of a schedule rule's and nothing moves when it lands.
  const handOverShape = (ruleId: string, from: RuleRow | undefined) => {
    if (from) setRouteShape(priceRuleShapeKey(ruleId), priceRuleFormShape(from));
  };

  const handleEdit = (id: string) => {
    setEditingId(id);
    handOverShape(id, rules.find((r) => r.id === id));
    startNavigate(() => router.push({ pathname: editPathname, params: { id: productId, ruleId: id } }));
  };

  const handleDuplicate = (id: string) => {
    setPending({ id, kind: "duplicate" });
    startDuplicate(async () => {
      const res = await duplicatePriceRule(id);
      if (!("id" in res)) {
        toast.error(res.message);
        setPending(null);
        return;
      }
      const copyId = res.id;
      announceDuplicated({
        message: t("duplicated"),
        action: {
          label: t("editCopy"),
          // The copy is the same rule, paused - so the same shape.
          onClick: () => {
            handOverShape(copyId, rules.find((r) => r.id === id));
            router.push({ pathname: editPathname, params: { id: productId, ruleId: copyId } });
          },
        },
      });
      // The spinner runs until the refreshed list shows the copy; the row
      // stays (unlike a delete), so its buttons are re-armed on that frame.
      whenDuplicated(() => setPending(null));
      router.refresh();
    });
  };

  const handleDelete = (id: string) => {
    setPending({ id, kind: "delete" });
    startDelete(async () => {
      const res = await deletePriceRule(id);
      if ("error" in res) {
        toast.error(res.message);
        setPending(null);
        return;
      }
      announceDeleted({ message: t("deleted") });
      // The deleted row unmounts, but `pending` would outlive it - and every
      // other row disables edit and duplicate while anything is pending, so
      // they stayed grey until a reload. Released on the frame the row is gone.
      whenDeleted(() => setPending(null));
      router.refresh();
    });
  };

  if (rules.length === 0) {
    return <p className="rounded-lg border p-6 text-sm text-muted-foreground">{t("empty")}</p>;
  }

  return (
    <TableScroll height="auto">
      <div role="row" className={cn(GRID, "border-b bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground min-w-fit")}>
        <div>{t("table.name")}</div>
        <div>{t("table.appliesTo")}</div>
        <div>{t("table.change")}</div>
        <div>{t("table.schedule")}</div>
        <div className="text-right">{t("table.priority")}</div>
        <div className="text-center">{t("table.status")}</div>
        <div className="text-right pr-2.5">{canWrite ? t("table.actions") : null}</div>
      </div>
      {rules.map((r) => {
        const busy = pending?.id === r.id;
        return (
          <div key={r.id} role="row" className={cn(GRID, "border-b last:border-b-0 px-3 py-2.5 text-sm min-w-fit")}>
            <div className="font-medium truncate">{r.name}</div>
            <div className="truncate text-muted-foreground">
              {r.variantId ? t("variant", { sku: variantSku[r.variantId] ?? "" }) : t("wholeProduct")}
            </div>
            <div className="tabular-nums">{change(r)}</div>
            <div className="text-muted-foreground">{schedule(r)}</div>
            <div className="text-right tabular-nums">{r.priority}</div>
            <div className="text-center">
              <Badge variant={STATUS_VARIANT[r.status]}>{t(`status.${r.status}`)}</Badge>
            </div>
            {/* No `pr-2.5` here: the header carries it, so its text ends where
                the trash glyph does - the same pairing as every admin table. */}
            <div className="flex items-center justify-end gap-1">
              {canWrite && (
                <>
                  <IconButton
                    label={t("table.edit")}
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    disabled={locked}
                    onClick={() => handleEdit(r.id)}
                  >
                    {isNavigating && editingId === r.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Pencil className="h-4 w-4" />
                    )}
                  </IconButton>
                  <IconButton
                    label={t("table.duplicate")}
                    className="h-8 w-8"
                    disabled={locked}
                    onClick={() => handleDuplicate(r.id)}
                  >
                    {busy && pending?.kind === "duplicate" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </IconButton>
                  <ActionButton
                    open={deleteOpenId === r.id}
                    onOpenChange={(open) => setDeleteOpenId(open ? r.id : null)}
                    title={t("deleteConfirm", { name: r.name })}
                    description={t("deleteDesc")}
                    confirmText={tc("delete")}
                    loadingText={t("deleting")}
                    isLoading={busy && pending?.kind === "delete"}
                    onConfirm={() => handleDelete(r.id)}
                  >
                    {/* Resting control - the dialog's confirm button carries the spinner. */}
                    <IconButton label={tc("delete")} size="icon" variant="ghostDestructive" className="h-8 w-8">
                      <Trash2 className="h-4 w-4" />
                    </IconButton>
                  </ActionButton>
                </>
              )}
            </div>
          </div>
        );
      })}
    </TableScroll>
  );
}
