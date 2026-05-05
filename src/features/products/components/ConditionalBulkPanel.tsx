"use client";

import { useState, useTransition, useId } from "react";
import { useTranslations } from "next-intl";
import { Plus, Trash2, Search, AlertCircle, CheckCircle2, Loader2, ChevronDown } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/components/ui/sonner";

import {
  previewBulkFilter,
  bulkDeleteByFilter,
  bulkUpdateByFilter,
  type PreviewResult,
} from "@/features/products/actions/products";
import type { BulkFilter, BulkUpdateFields } from "@/features/products/types/bulk";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type BrandOption = { id: string; name: string };

const STATUS_OPTIONS = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const;
type ProductStatus = (typeof STATUS_OPTIONS)[number];

function getStatusVariant(s: string) {
  if (s === "PUBLISHED") return "default" as const;
  if (s === "DRAFT") return "secondary" as const;
  return "destructive" as const;
}

// A single condition the user has configured.
type ConditionType = "brand" | "noBrand" | "status" | "minPrice" | "maxPrice" | "titleContains";

type Condition =
  | { type: "brand"; brandIds: string[] }
  | { type: "noBrand" }
  | { type: "status"; statuses: ProductStatus[] }
  | { type: "minPrice"; value: number }
  | { type: "maxPrice"; value: number }
  | { type: "titleContains"; value: string };

// The action to apply to matching products.
type ActionType = "delete" | "setStatus" | "setBrand" | "removeBrand" | "setPrice" | "setCompareAtPrice" | "setCostPrice" | "setTaxable" | "setRequiresShipping";

// ---------------------------------------------------------------------------
// Helper: build BulkFilter from conditions array
// ---------------------------------------------------------------------------

function conditionsToFilter(conditions: Condition[]): BulkFilter {
  const filter: BulkFilter = {};
  for (const c of conditions) {
    if (c.type === "brand" && c.brandIds.length > 0) filter.brandId = c.brandIds;
    else if (c.type === "noBrand") filter.noBrand = true;
    else if (c.type === "status" && c.statuses.length > 0) filter.status = c.statuses;
    else if (c.type === "minPrice") filter.minPrice = c.value;
    else if (c.type === "maxPrice") filter.maxPrice = c.value;
    else if (c.type === "titleContains" && c.value) filter.titleContains = c.value;
  }
  return filter;
}

// ---------------------------------------------------------------------------
// Condition row
// ---------------------------------------------------------------------------

function ConditionRow({
  condition,
  brands,
  onUpdate,
  onRemove,
}: {
  condition: Condition;
  brands: BrandOption[];
  onUpdate: (c: Condition) => void;
  onRemove: () => void;
}) {
  const t = useTranslations("bulkProducts");
  const id = useId();

  const STATUS_LABELS: Record<string, string> = {
    DRAFT: t("draft"),
    PUBLISHED: t("published"),
    ARCHIVED: t("archived"),
  };

  const CONDITION_LABELS: Record<ConditionType, string> = {
    brand: t("condBrand"),
    noBrand: t("condNoBrand"),
    status: t("condStatus"),
    minPrice: t("condMinPrice"),
    maxPrice: t("condMaxPrice"),
    titleContains: t("condTitleContains"),
  };

  const toggleBrand = (brandId: string) => {
    if (condition.type !== "brand") return;
    const existing = condition.brandIds;
    const next = existing.includes(brandId)
      ? existing.filter((b) => b !== brandId)
      : [...existing, brandId];
    onUpdate({ type: "brand", brandIds: next });
  };

  const toggleStatus = (s: ProductStatus) => {
    if (condition.type !== "status") return;
    const existing = condition.statuses;
    const next = existing.includes(s) ? existing.filter((x) => x !== s) : [...existing, s];
    onUpdate({ type: "status", statuses: next });
  };

  return (
    <div className="flex items-start gap-2 rounded-lg border bg-muted/30 p-3">
      {/* Condition type label */}
      <span className="text-sm font-medium pt-0.5 w-44 shrink-0">
        {CONDITION_LABELS[condition.type]}
      </span>

      {/* Value editor */}
      <div className="flex-1 min-w-0">
        {condition.type === "brand" && (
          <div className="flex flex-wrap gap-1.5">
            {brands.length === 0 ? (
              <span className="text-xs text-muted-foreground">{t("noBrandsFound")}</span>
            ) : (
              brands.map((b) => {
                const selected = condition.brandIds.includes(b.id);
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => toggleBrand(b.id)}
                    className={`cursor-pointer rounded-full border px-2.5 py-0.5 text-xs transition-colors ${
                      selected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background hover:bg-muted"
                    }`}
                  >
                    {b.name}
                  </button>
                );
              })
            )}
          </div>
        )}

        {condition.type === "noBrand" && (
          <span className="text-sm text-muted-foreground">{t("noBrandAssigned")}</span>
        )}

        {condition.type === "status" && (
          <div className="flex gap-1.5">
            {STATUS_OPTIONS.map((s) => {
              const selected = condition.statuses.includes(s);
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleStatus(s)}
                  className={`cursor-pointer rounded-full border px-2.5 py-0.5 text-xs transition-colors ${
                    selected
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background hover:bg-muted"
                  }`}
                >
                  {STATUS_LABELS[s]}
                </button>
              );
            })}
          </div>
        )}

        {(condition.type === "minPrice" || condition.type === "maxPrice") && (
          <div className="relative w-36">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
            <Input
              id={id}
              type="number"
              min="0"
              step="0.01"
              className="pl-7 h-8 text-sm"
              value={condition.value}
              onChange={(e) =>
                onUpdate({
                  type: condition.type as "minPrice" | "maxPrice",
                  value: parseFloat(e.target.value) || 0,
                })
              }
            />
          </div>
        )}

        {condition.type === "titleContains" && (
          <Input
            id={id}
            className="h-8 text-sm max-w-xs"
            placeholder='e.g. "adidas"'
            value={condition.value}
            onChange={(e) => onUpdate({ type: "titleContains", value: e.target.value })}
          />
        )}
      </div>

      <Button variant="ghost" size="icon" className="shrink-0 h-7 w-7" onClick={onRemove}>
        <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Action editor
// ---------------------------------------------------------------------------

function ActionEditor({
  action,
  onChangeType,
  onChangeValue,
  brands,
}: {
  action: { type: ActionType; value?: string | number | boolean | null };
  onChangeType: (t: ActionType) => void;
  onChangeValue: (v: string | number | boolean | null) => void;
  brands: BrandOption[];
}) {
  const t = useTranslations("bulkProducts");

  const STATUS_LABELS: Record<string, string> = {
    DRAFT: t("draft"),
    PUBLISHED: t("published"),
    ARCHIVED: t("archived"),
  };

  const ACTION_LABELS: Record<ActionType, string> = {
    delete: t("actDelete"),
    setStatus: t("actSetStatus"),
    setBrand: t("actSetBrand"),
    removeBrand: t("actRemoveBrand"),
    setPrice: t("actSetPrice"),
    setCompareAtPrice: t("actSetCompareAtPrice"),
    setCostPrice: t("actSetCostPrice"),
    setTaxable: t("actSetTaxable"),
    setRequiresShipping: t("actSetRequiresShipping"),
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs text-muted-foreground">{t("actionLabel")}</Label>
        <Select value={action.type} onValueChange={(v) => onChangeType(v as ActionType)}>
          <SelectTrigger className="w-fit min-w-60">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(ACTION_LABELS) as ActionType[]).map((k) => (
              <SelectItem key={k} value={k}>
                {ACTION_LABELS[k]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Action-specific value input */}
      {action.type === "setStatus" && (
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs text-muted-foreground">{t("newStatus")}</Label>
          <Select
            value={(action.value as string) ?? ""}
            onValueChange={(v) => onChangeValue(v)}
          >
            <SelectTrigger className="w-44">
              <SelectValue placeholder={t("pickStatus")} />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {action.type === "setBrand" && (
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs text-muted-foreground">{t("newBrand")}</Label>
          <Select
            value={(action.value as string) ?? ""}
            onValueChange={(v) => onChangeValue(v)}
          >
            <SelectTrigger className="w-56">
              <SelectValue placeholder={t("pickBrand")} />
            </SelectTrigger>
            <SelectContent>
              {brands.map((b) => (
                <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {(action.type === "setPrice" ||
        action.type === "setCompareAtPrice" ||
        action.type === "setCostPrice") && (
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs text-muted-foreground">
            {action.type === "setPrice"
              ? t("newPrice")
              : action.type === "setCompareAtPrice"
              ? t("newCompareAt")
              : t("newCost")}
          </Label>
          <div className="relative w-36">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
            <Input
              type="number"
              min="0"
              step="0.01"
              className="pl-7 h-8 text-sm"
              value={(action.value as number) ?? 0}
              onChange={(e) => onChangeValue(parseFloat(e.target.value) || 0)}
            />
          </div>
        </div>
      )}

      {(action.type === "setTaxable" || action.type === "setRequiresShipping") && (
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs text-muted-foreground">{t("valueLabel")}</Label>
          <Select
            value={action.value === true ? "true" : "false"}
            onValueChange={(v) => onChangeValue(v === "true")}
          >
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="true">{t("yes")}</SelectItem>
              <SelectItem value="false">{t("no")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Preview card
// ---------------------------------------------------------------------------

function PreviewCard({ preview }: { preview: PreviewResult }) {
  const t = useTranslations("bulkProducts");
  return (
    <div className="rounded-lg border bg-muted/20 p-4 flex flex-col gap-3">
      <p className="text-sm font-semibold">
        {preview.count === 0
          ? t("noMatch")
          : t("willAffect", { count: preview.count })}
      </p>
      {preview.samples.length > 0 && (
        <div className="rounded border overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-background">
                <th className="px-3 py-1.5 text-left font-medium text-muted-foreground">{t("colTitle")}</th>
                <th className="px-3 py-1.5 text-left font-medium text-muted-foreground">{t("colPrice")}</th>
                <th className="px-3 py-1.5 text-left font-medium text-muted-foreground">{t("colStatus")}</th>
                <th className="px-3 py-1.5 text-left font-medium text-muted-foreground">{t("colBrand")}</th>
              </tr>
            </thead>
            <tbody>
              {preview.samples.map((p) => (
                <tr key={p.id} className="border-b last:border-b-0">
                  <td className="px-3 py-1.5 max-w-50 truncate font-medium">{p.title}</td>
                  <td className="px-3 py-1.5">${p.price.toFixed(2)}</td>
                  <td className="px-3 py-1.5">
                    <Badge variant={getStatusVariant(p.status)} className="text-[10px]">
                      {p.status}
                    </Badge>
                  </td>
                  <td className="px-3 py-1.5 text-muted-foreground">
                    {p.brand?.name ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {preview.count > preview.samples.length && (
            <p className="px-3 py-1.5 text-xs text-muted-foreground border-t">
              {t("andMore", { count: preview.count - preview.samples.length })}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

function makeDefaultCondition(type: ConditionType): Condition {
  switch (type) {
    case "brand": return { type: "brand", brandIds: [] };
    case "noBrand": return { type: "noBrand" };
    case "status": return { type: "status", statuses: [] };
    case "minPrice": return { type: "minPrice", value: 0 };
    case "maxPrice": return { type: "maxPrice", value: 0 };
    case "titleContains": return { type: "titleContains", value: "" };
  }
}

export function ConditionalBulkPanel({ brands }: { brands: BrandOption[] }) {
  const t = useTranslations("bulkProducts");
  const tCommon = useTranslations("common");
  const queryClient = useQueryClient();

  const ADDABLE_CONDITIONS: { type: ConditionType; label: string }[] = [
    { type: "brand", label: t("condBrand") },
    { type: "noBrand", label: t("condNoBrand") },
    { type: "status", label: t("condStatus") },
    { type: "minPrice", label: t("condMinPrice") },
    { type: "maxPrice", label: t("condMaxPrice") },
    { type: "titleContains", label: t("condTitleContains") },
  ];

  const [conditions, setConditions] = useState<Condition[]>([]);
  const [action, setAction] = useState<{
    type: ActionType;
    value?: string | number | boolean | null;
  }>({ type: "setStatus", value: "DRAFT" });
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [isPreviewing, startPreview] = useTransition();
  const [isExecuting, startExecute] = useTransition();
  const [lastResult, setLastResult] = useState<{ count: number; message: string } | null>(null);

  const [showAddMenu, setShowAddMenu] = useState(false);

  const addCondition = (type: ConditionType) => {
    // Only one condition per type (except brand + noBrand can coexist makes no sense — prevent duplicates)
    if (conditions.some((c) => c.type === type)) return;
    setConditions((prev) => [...prev, makeDefaultCondition(type)]);
    setPreview(null);
    setShowAddMenu(false);
  };

  const updateCondition = (index: number, c: Condition) => {
    setConditions((prev) => prev.map((existing, i) => (i === index ? c : existing)));
    setPreview(null);
    setLastResult(null);
  };

  const removeCondition = (index: number) => {
    setConditions((prev) => prev.filter((_, i) => i !== index));
    setPreview(null);
    setLastResult(null);
  };

  const existingTypes = new Set(conditions.map((c) => c.type));

  const handlePreview = () => {
    const filter = conditionsToFilter(conditions);
    startPreview(async () => {
      const res = await previewBulkFilter(filter);
      if (res.error) {
        toast.error(res.message);
        return;
      }
      setPreview((res as { error: false; data: PreviewResult }).data);
    });
  };

  // Build BulkUpdateFields from current action state
  const buildUpdateFields = (): BulkUpdateFields => {
    switch (action.type) {
      case "setStatus": return { status: action.value as ProductStatus };
      case "setBrand": return { brandId: action.value as string };
      case "removeBrand": return { brandId: null };
      case "setPrice": return { price: action.value as number };
      case "setCompareAtPrice":
        return { compareAtPrice: (action.value as number) > 0 ? (action.value as number) : null };
      case "setCostPrice":
        return { costPrice: (action.value as number) > 0 ? (action.value as number) : null };
      case "setTaxable": return { taxable: action.value as boolean };
      case "setRequiresShipping": return { requiresShipping: action.value as boolean };
      default: return {};
    }
  };

  const isActionValid = (): boolean => {
    if (action.type === "delete" || action.type === "removeBrand") return true;
    if (action.type === "setStatus") return !!action.value;
    if (action.type === "setBrand") return !!action.value;
    if (action.type === "setPrice") return (action.value as number) > 0;
    if (action.type === "setCompareAtPrice" || action.type === "setCostPrice") return action.value !== undefined;
    if (action.type === "setTaxable" || action.type === "setRequiresShipping") return action.value !== undefined;
    return true;
  };

  const handleExecute = () => {
    const filter = conditionsToFilter(conditions);
    startExecute(async () => {
      let res;
      if (action.type === "delete") {
        res = await bulkDeleteByFilter(filter);
      } else {
        res = await bulkUpdateByFilter(filter, buildUpdateFields());
      }

      if (res.error) {
        toast.error(res.message);
        return;
      }

      const ok = res as { error: false; count: number; message: string };
      setLastResult({ count: ok.count, message: ok.message });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setPreview(null);

      if (action.type === "delete") {
        // Clear conditions after a successful delete so user doesn't accidentally re-run
        setConditions([]);
      }

      toast.success(ok.message);
    });
  };

  const hasConditions = conditions.length > 0;
  const effectivePreviewCount = preview?.count ?? 0;
  const canExecute = hasConditions && isActionValid() && preview !== null && effectivePreviewCount > 0;

  const confirmDescription = () => {
    const count = effectivePreviewCount;
    if (action.type === "delete") return t("confirmDeleteDesc", { count });
    return t("confirmUpdateDesc", { count });
  };

  const confirmLabel = () => {
    const count = effectivePreviewCount;
    if (action.type === "delete") return t("deleteBulk", { count });
    return t("updateBulk", { count });
  };

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      {/* ── Conditions ─────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">
            {t("defineConditions")}{" "}
            <span className="font-normal text-muted-foreground">{t("andLogic")}</span>
          </h3>
        </div>

        {conditions.length === 0 && (
          <p className="text-sm text-muted-foreground">
            {t("noConditions")}
          </p>
        )}

        {conditions.map((condition, i) => (
          <ConditionRow
            key={i}
            condition={condition}
            brands={brands}
            onUpdate={(c) => updateCondition(i, c)}
            onRemove={() => removeCondition(i)}
          />
        ))}

        {/* Add condition menu */}
        <div className="relative w-fit">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setShowAddMenu((v) => !v)}
          >
            <Plus className="h-3.5 w-3.5" />
            {t("addCondition")}
            <ChevronDown className="h-3.5 w-3.5" />
          </Button>
          {showAddMenu && (
            <div className="absolute left-0 top-full mt-1 z-20 w-52 rounded-lg border bg-popover shadow-lg py-1">
              {ADDABLE_CONDITIONS.map(({ type, label }) => {
                const alreadyAdded = existingTypes.has(type);
                return (
                  <button
                    key={type}
                    type="button"
                    disabled={alreadyAdded}
                    onClick={() => addCondition(type)}
                    className="flex w-full cursor-pointer items-center px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed text-left"
                  >
                    {label}
                    {alreadyAdded && (
                      <span className="ml-auto text-xs text-muted-foreground">{t("added")}</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <Separator />

      {/* ── Action ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold">{t("chooseAction")}</h3>
        <ActionEditor
          action={action}
          onChangeType={(t) => setAction({ type: t, value: t === "setTaxable" || t === "setRequiresShipping" ? true : undefined })}
          onChangeValue={(v) => setAction((prev) => ({ ...prev, value: v }))}
          brands={brands}
        />
      </div>

      <Separator />

      {/* ── Preview ────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold">{t("previewExecute")}</h3>

        <Button
          variant="outline"
          size="sm"
          className="w-fit gap-2"
          onClick={handlePreview}
          disabled={isPreviewing}
        >
          {isPreviewing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Search className="h-3.5 w-3.5" />
          )}
          {isPreviewing ? t("previewing") : t("previewBtn")}
        </Button>

        {preview && <PreviewCard preview={preview} />}

        {lastResult && (
          <Alert>
            <CheckCircle2 className="h-4 w-4" />
            <AlertTitle>{t("done")}</AlertTitle>
            <AlertDescription>{lastResult.message}</AlertDescription>
          </Alert>
        )}

        {/* Execute button + confirm dialog */}
        {preview !== null && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                disabled={!canExecute || isExecuting}
                variant={action.type === "delete" ? "destructive" : "default"}
                className="w-fit gap-2"
              >
                {isExecuting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : action.type === "delete" ? (
                  <Trash2 className="h-4 w-4" />
                ) : null}
                {isExecuting
                  ? t("executing")
                  : effectivePreviewCount === 0
                  ? t("noProductsToUpdate")
                  : !isActionValid()
                  ? t("selectActionValue")
                  : confirmLabel()}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {action.type === "delete" ? t("confirmBulkDelete") : t("confirmBulkUpdate")}
                </AlertDialogTitle>
                <AlertDialogDescription>{confirmDescription()}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{tCommon("cancel")}</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleExecute}
                  className={
                    action.type === "delete"
                      ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      : undefined
                  }
                >
                  {confirmLabel()}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}

        {preview === null && !isPreviewing && (
          <p className="text-xs text-muted-foreground">
            {t("previewFirst")}
          </p>
        )}

        {preview !== null && effectivePreviewCount === 0 && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>{t("noMatches")}</AlertTitle>
            <AlertDescription>
              {t("noMatchesDesc")}
            </AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  );
}