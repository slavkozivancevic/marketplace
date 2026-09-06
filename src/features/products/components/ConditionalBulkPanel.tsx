"use client";

import { useEffect, useRef, useState, useTransition, useId } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Plus, Trash2, Search, AlertCircle, CheckCircle2, Loader2, ChevronDown, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { SaveBlockedNotice } from "@/components/forms/SaveBlockedNotice";
import { Input } from "@/components/ui/input";
import { NumberStepper } from "@/components/ui/number-stepper";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { useCurrencyStore } from "@/store/currency";
import { formatPrice, convertCents } from "@/lib/currency";
import { PriceInput } from "./PriceInput";
import { CountrySelect } from "./CountrySelect";
import { countryName } from "@/lib/i18n/countries";
import { MAX_WARRANTY_MONTHS } from "@/features/products/schema/products";

import {
  previewBulkFilter,
  bulkDeleteByFilter,
  bulkUpdateByFilter,
  type PreviewResult,
} from "@/features/products/actions/products";
import type { BulkFilter, BulkUpdateFields } from "@/features/products/types/bulk";
import { BULK_CATEGORY_MUTATION_LIMIT } from "@/features/products/types/bulk";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type BrandOption = { id: string; name: string };
/** Pre-flattened with indented `pathName` (e.g. "Apparel > Shoes > Men"). */
type CategoryOption = { id: string; name: string; pathName: string };
type TagOption = { id: string; name: string };

const STATUS_OPTIONS = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const;
type ProductStatus = (typeof STATUS_OPTIONS)[number];

function getStatusVariant(s: string) {
  if (s === "PUBLISHED") return "default" as const;
  if (s === "DRAFT") return "secondary" as const;
  return "destructive" as const;
}

// A single condition the user has configured.
type ConditionType =
  | "brand"
  | "noBrand"
  | "category"
  | "noCategory"
  | "tag"
  | "noTag"
  | "status"
  | "minPrice"
  | "maxPrice"
  | "minStock"
  | "maxStock"
  | "outOfStock"
  | "taxable"
  | "requiresShipping"
  | "isDigital"
  | "countryOfOrigin"
  | "noCountryOfOrigin"
  | "minWarrantyMonths"
  | "maxWarrantyMonths"
  | "noWarranty"
  | "titleContains";

type Condition =
  | { type: "brand"; brandIds: string[] }
  | { type: "noBrand" }
  | { type: "category"; categoryIds: string[] }
  | { type: "noCategory" }
  | { type: "tag"; tagIds: string[] }
  | { type: "noTag" }
  | { type: "status"; statuses: ProductStatus[] }
  | { type: "minPrice"; value: number }
  | { type: "maxPrice"; value: number }
  | { type: "minStock"; value: number }
  | { type: "maxStock"; value: number }
  | { type: "outOfStock" }
  | { type: "taxable"; value: boolean }
  | { type: "requiresShipping"; value: boolean }
  | { type: "isDigital"; value: boolean }
  | { type: "countryOfOrigin"; codes: string[] }
  | { type: "noCountryOfOrigin" }
  | { type: "minWarrantyMonths"; value: number }
  | { type: "maxWarrantyMonths"; value: number }
  | { type: "noWarranty" }
  | { type: "titleContains"; value: string };

// The action to apply to matching products.
type ActionType =
  | "delete"
  | "setStatus"
  | "setBrand"
  | "removeBrand"
  | "setCategoriesReplace"
  | "addCategories"
  | "removeCategories"
  | "clearCategories"
  | "setTagsReplace"
  | "addTags"
  | "removeTags"
  | "clearTags"
  | "setPrice"
  | "setCompareAtPrice"
  | "setCostPrice"
  | "setStock"
  | "setTaxable"
  | "setRequiresShipping"
  | "setIsDigital"
  | "setWarrantyMonths"
  | "clearWarrantyMonths"
  | "setCountryOfOrigin"
  | "clearCountryOfOrigin";

// Mutually-exclusive condition pairs. Map is symmetric: looking up either
// member yields the other(s). Shared between the add-menu (to disable
// conflicting items) and addCondition() (defensive guard).
const MUTEX_PARTNERS: Partial<Record<ConditionType, ConditionType[]>> = {
  brand: ["noBrand"],
  noBrand: ["brand"],
  category: ["noCategory"],
  noCategory: ["category"],
  tag: ["noTag"],
  noTag: ["tag"],
  minStock: ["outOfStock"],
  maxStock: ["outOfStock"],
  outOfStock: ["minStock", "maxStock"],
  countryOfOrigin: ["noCountryOfOrigin"],
  noCountryOfOrigin: ["countryOfOrigin"],
  minWarrantyMonths: ["noWarranty"],
  maxWarrantyMonths: ["noWarranty"],
  noWarranty: ["minWarrantyMonths", "maxWarrantyMonths"],
};

/**
 * The message key for a value that has been entered but is not usable, or null
 * when the value is fine (or simply not filled in yet - "not ready" is not an
 * error).
 *
 * Gated on the action type, not just the value: each action carries a value of
 * its own shape ("DRAFT", a brand id, an array), and running a numeric check
 * over all of them made `Number("DRAFT")` NaN and reported "fix the value" for
 * a perfectly valid status change.
 */
function actionValueError(
  actionType: ActionType,
  value: unknown,
): "warrantyOutOfRange" | "pricePositive" | "priceNonNegative" | "stockNonNegative" | null {
  if (value == null || value === "") return null;

  if (actionType === "setWarrantyMonths") {
    const months = Number(value);
    return !Number.isInteger(months) || months < 0 || months > MAX_WARRANTY_MONTHS
      ? "warrantyOutOfRange"
      : null;
  }
  // The selling price cannot be zero; compare-at and cost can (0 clears them).
  if (actionType === "setPrice") {
    const n = Number(value);
    return !Number.isFinite(n) || n <= 0 ? "pricePositive" : null;
  }
  if (actionType === "setCompareAtPrice" || actionType === "setCostPrice") {
    const n = Number(value);
    return !Number.isFinite(n) || n < 0 ? "priceNonNegative" : null;
  }
  if (actionType === "setStock") {
    const n = Number(value);
    return !Number.isInteger(n) || n < 0 ? "stockNonNegative" : null;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Helper: build BulkFilter from conditions array
// ---------------------------------------------------------------------------

function conditionsToFilter(conditions: Condition[]): BulkFilter {
  const filter: BulkFilter = {};
  for (const c of conditions) {
    switch (c.type) {
      case "brand":
        if (c.brandIds.length > 0) filter.brandId = c.brandIds;
        break;
      case "noBrand":
        filter.noBrand = true;
        break;
      case "category":
        if (c.categoryIds.length > 0) filter.categoryId = c.categoryIds;
        break;
      case "noCategory":
        filter.noCategory = true;
        break;
      case "tag":
        if (c.tagIds.length > 0) filter.tagId = c.tagIds;
        break;
      case "noTag":
        filter.noTag = true;
        break;
      case "status":
        if (c.statuses.length > 0) filter.status = c.statuses;
        break;
      case "minPrice":
        filter.minPrice = c.value;
        break;
      case "maxPrice":
        filter.maxPrice = c.value;
        break;
      case "minStock":
        filter.minStock = c.value;
        break;
      case "maxStock":
        filter.maxStock = c.value;
        break;
      case "outOfStock":
        filter.outOfStock = true;
        break;
      case "taxable":
        filter.taxable = c.value;
        break;
      case "requiresShipping":
        filter.requiresShipping = c.value;
        break;
      case "isDigital":
        filter.isDigital = c.value;
        break;
      case "countryOfOrigin":
        if (c.codes.length > 0) filter.countryOfOrigin = c.codes;
        break;
      case "noCountryOfOrigin":
        filter.noCountryOfOrigin = true;
        break;
      case "minWarrantyMonths":
        filter.minWarrantyMonths = c.value;
        break;
      case "maxWarrantyMonths":
        filter.maxWarrantyMonths = c.value;
        break;
      case "noWarranty":
        filter.noWarranty = true;
        break;
      case "titleContains":
        if (c.value) filter.titleContains = c.value;
        break;
    }
  }
  return filter;
}

// ---------------------------------------------------------------------------
// Reusable multi-pick chip group
// ---------------------------------------------------------------------------

function ChipGroup<T extends { id: string }>({
  options,
  selectedIds,
  onToggle,
  labelFor,
  emptyMessage,
  maxHeightClass = "max-h-40",
}: {
  options: T[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  labelFor: (opt: T) => string;
  emptyMessage: string;
  maxHeightClass?: string;
}) {
  if (options.length === 0) {
    return <span className="text-xs text-muted-foreground">{emptyMessage}</span>;
  }
  return (
    <div className={`flex flex-wrap gap-1.5 overflow-y-auto ${maxHeightClass}`}>
      {options.map((opt) => {
        const selected = selectedIds.includes(opt.id);
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onToggle(opt.id)}
            className={`cursor-pointer rounded-full border px-2.5 py-0.5 text-xs transition-colors ${
              selected
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background hover:bg-muted"
            }`}
            title={labelFor(opt)}
          >
            {labelFor(opt)}
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Condition row
// ---------------------------------------------------------------------------

function ConditionRow({
  condition,
  brands,
  categories,
  tags,
  onUpdate,
  onRemove,
}: {
  condition: Condition;
  brands: BrandOption[];
  categories: CategoryOption[];
  tags: TagOption[];
  onUpdate: (c: Condition) => void;
  onRemove: () => void;
}) {
  const t = useTranslations("bulkProducts");
  const locale = useLocale();
  const id = useId();
  const { rates, currency } = useCurrencyStore();

  const STATUS_LABELS: Record<string, string> = {
    DRAFT: t("draft"),
    PUBLISHED: t("published"),
    ARCHIVED: t("archived"),
  };

  const CONDITION_LABELS: Record<ConditionType, string> = {
    brand: t("condBrand"),
    noBrand: t("condNoBrand"),
    category: t("condCategory"),
    noCategory: t("condNoCategory"),
    tag: t("condTag"),
    noTag: t("condNoTag"),
    status: t("condStatus"),
    minPrice: t("condMinPrice"),
    maxPrice: t("condMaxPrice"),
    minStock: t("condMinStock"),
    maxStock: t("condMaxStock"),
    outOfStock: t("condOutOfStock"),
    taxable: t("condTaxable"),
    requiresShipping: t("condRequiresShipping"),
    isDigital: t("condIsDigital"),
    countryOfOrigin: t("condCountryOfOrigin"),
    noCountryOfOrigin: t("condNoCountryOfOrigin"),
    minWarrantyMonths: t("condMinWarrantyMonths"),
    maxWarrantyMonths: t("condMaxWarrantyMonths"),
    noWarranty: t("condNoWarranty"),
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

  const toggleCategory = (categoryId: string) => {
    if (condition.type !== "category") return;
    const existing = condition.categoryIds;
    const next = existing.includes(categoryId)
      ? existing.filter((c) => c !== categoryId)
      : [...existing, categoryId];
    onUpdate({ type: "category", categoryIds: next });
  };

  const toggleTag = (tagId: string) => {
    if (condition.type !== "tag") return;
    const existing = condition.tagIds;
    const next = existing.includes(tagId)
      ? existing.filter((t) => t !== tagId)
      : [...existing, tagId];
    onUpdate({ type: "tag", tagIds: next });
  };

  const toggleStatus = (s: ProductStatus) => {
    if (condition.type !== "status") return;
    const existing = condition.statuses;
    const next = existing.includes(s) ? existing.filter((x) => x !== s) : [...existing, s];
    onUpdate({ type: "status", statuses: next });
  };

  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-muted/30 p-3 sm:flex-row sm:items-start">
      {/* Condition type label + (mobile) remove button share a row; on sm+
          this wrapper drops out of the box model via `contents` so the
          label and button become direct flex items of the row below,
          ordered label / value / trash to match the desktop layout. */}
      <div className="flex items-center justify-between gap-2 sm:contents">
        <span className="text-sm font-medium sm:w-44 sm:shrink-0 sm:pt-0.5">
          {CONDITION_LABELS[condition.type]}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0 sm:order-last"
          onClick={onRemove}
        >
          <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      </div>

      {/* Value editor */}
      <div className="min-w-0 flex-1">
        {condition.type === "brand" && (
          <ChipGroup
            options={brands}
            selectedIds={condition.brandIds}
            onToggle={toggleBrand}
            labelFor={(b) => b.name}
            emptyMessage={t("noBrandsFound")}
          />
        )}

        {condition.type === "noBrand" && (
          <span className="text-sm text-muted-foreground">{t("noBrandAssigned")}</span>
        )}

        {condition.type === "category" && (
          <ChipGroup
            options={categories}
            selectedIds={condition.categoryIds}
            onToggle={toggleCategory}
            labelFor={(c) => c.pathName}
            emptyMessage={t("noCategoriesFound")}
          />
        )}

        {condition.type === "noCategory" && (
          <span className="text-sm text-muted-foreground">{t("noCategoryAssigned")}</span>
        )}

        {condition.type === "tag" && (
          <ChipGroup
            options={tags}
            selectedIds={condition.tagIds}
            onToggle={toggleTag}
            labelFor={(tg) => tg.name}
            emptyMessage={t("noTagsFound")}
          />
        )}

        {condition.type === "noTag" && (
          <span className="text-sm text-muted-foreground">{t("noTagAssigned")}</span>
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
          <PriceInput
            className="w-64"
            value={Number(condition.value) || 0}
            rates={rates}
            defaultCurrency={currency}
            onChange={(usd) =>
              onUpdate({
                type: condition.type as "minPrice" | "maxPrice",
                value: usd,
              })
            }
          />
        )}

        {(condition.type === "minStock" || condition.type === "maxStock") && (
          <div className="flex flex-col gap-1">
            <NumberStepper
              id={id}
              min={0}
              className="h-8 text-sm w-36"
              value={condition.value as number}
              onChange={(v) =>
                onUpdate({
                  type: condition.type as "minStock" | "maxStock",
                  value: v ?? 0,
                })
              }
            />
            <p className="text-xs text-muted-foreground">{t("stockEitherSourceHint")}</p>
          </div>
        )}

        {condition.type === "outOfStock" && (
          <span className="text-sm text-muted-foreground">{t("outOfStockDesc")}</span>
        )}

        {(condition.type === "taxable" ||
          condition.type === "requiresShipping" ||
          condition.type === "isDigital") && (
          <Select
            value={condition.value ? "true" : "false"}
            onValueChange={(v) =>
              onUpdate({
                type: condition.type as "taxable" | "requiresShipping" | "isDigital",
                value: v === "true",
              })
            }
          >
            <SelectTrigger className="w-28">
              <SelectValue>{condition.value ? t("yes") : t("no")}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="true">{t("yes")}</SelectItem>
              <SelectItem value="false">{t("no")}</SelectItem>
            </SelectContent>
          </Select>
        )}

        {(condition.type === "minWarrantyMonths" ||
          condition.type === "maxWarrantyMonths") && (
          <NumberStepper
            id={id}
            min={0}
            max={MAX_WARRANTY_MONTHS}
            className="h-8 text-sm w-36"
            value={condition.value as number}
            onChange={(v) =>
              onUpdate({
                type: condition.type as "minWarrantyMonths" | "maxWarrantyMonths",
                value: v ?? 0,
              })
            }
          />
        )}

        {condition.type === "noWarranty" && (
          <span className="text-sm text-muted-foreground">{t("noWarrantyDesc")}</span>
        )}

        {condition.type === "countryOfOrigin" && (
          <div className="flex flex-col gap-2">
            <CountrySelect
              value={null}
              onChange={(code) => {
                if (!code || condition.codes.includes(code)) return;
                onUpdate({ type: "countryOfOrigin", codes: [...condition.codes, code] });
              }}
            />
            {condition.codes.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {condition.codes.map((code) => (
                  <Badge key={code} variant="secondary" className="gap-1">
                    {countryName(code, locale)}
                    <button
                      type="button"
                      aria-label={t("removeCountry", { country: countryName(code, locale) })}
                      className="cursor-pointer"
                      onClick={() =>
                        onUpdate({
                          type: "countryOfOrigin",
                          codes: condition.codes.filter((c) => c !== code),
                        })
                      }
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>
        )}

        {condition.type === "noCountryOfOrigin" && (
          <span className="text-sm text-muted-foreground">
            {t("noCountryOfOriginDesc")}
          </span>
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
  categories,
  tags,
}: {
  action: { type: ActionType; value?: string | number | boolean | null | string[] };
  onChangeType: (t: ActionType) => void;
  onChangeValue: (v: string | number | boolean | null | string[]) => void;
  brands: BrandOption[];
  categories: CategoryOption[];
  tags: TagOption[];
}) {
  const t = useTranslations("bulkProducts");
  const { rates, currency } = useCurrencyStore();

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
    setCategoriesReplace: t("actSetCategoriesReplace"),
    addCategories: t("actAddCategories"),
    removeCategories: t("actRemoveCategories"),
    clearCategories: t("actClearCategories"),
    setTagsReplace: t("actSetTagsReplace"),
    addTags: t("actAddTags"),
    removeTags: t("actRemoveTags"),
    clearTags: t("actClearTags"),
    setPrice: t("actSetPrice"),
    setCompareAtPrice: t("actSetCompareAtPrice"),
    setCostPrice: t("actSetCostPrice"),
    setStock: t("actSetStock"),
    setTaxable: t("actSetTaxable"),
    setRequiresShipping: t("actSetRequiresShipping"),
    setIsDigital: t("actSetIsDigital"),
    setWarrantyMonths: t("actSetWarrantyMonths"),
    clearWarrantyMonths: t("actClearWarrantyMonths"),
    setCountryOfOrigin: t("actSetCountryOfOrigin"),
    clearCountryOfOrigin: t("actClearCountryOfOrigin"),
  };

  const isCategoryMultiSelectAction =
    action.type === "setCategoriesReplace" ||
    action.type === "addCategories" ||
    action.type === "removeCategories";

  const isTagMultiSelectAction =
    action.type === "setTagsReplace" ||
    action.type === "addTags" ||
    action.type === "removeTags";

  const valueError = actionValueError(action.type, action.value);

  const isBoolAction =
    action.type === "setTaxable" ||
    action.type === "setRequiresShipping" ||
    action.type === "setIsDigital";

  const selectedCategoryIds = (action.value as string[]) ?? [];
  const toggleCategoryAction = (id: string) => {
    const next = selectedCategoryIds.includes(id)
      ? selectedCategoryIds.filter((c) => c !== id)
      : [...selectedCategoryIds, id];
    onChangeValue(next);
  };

  const selectedTagIds = (action.value as string[]) ?? [];
  const toggleTagAction = (id: string) => {
    const next = selectedTagIds.includes(id)
      ? selectedTagIds.filter((tg) => tg !== id)
      : [...selectedTagIds, id];
    onChangeValue(next);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs text-muted-foreground">{t("actionLabel")}</Label>
        <Select value={action.type} onValueChange={(v) => onChangeType(v as ActionType)}>
          <SelectTrigger className="w-fit min-w-60">
            <SelectValue>{ACTION_LABELS[action.type]}</SelectValue>
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
              <SelectValue placeholder={t("pickStatus")}>
                {action.value
                  ? STATUS_LABELS[action.value as keyof typeof STATUS_LABELS]
                  : null}
              </SelectValue>
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
              <SelectValue placeholder={t("pickBrand")}>
                {action.value
                  ? brands.find((b) => b.id === action.value)?.name ?? null
                  : null}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {brands.map((b) => (
                <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {isCategoryMultiSelectAction && (
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs text-muted-foreground">
            {action.type === "setCategoriesReplace"
              ? t("pickCategoriesReplace")
              : action.type === "addCategories"
              ? t("pickCategoriesAdd")
              : t("pickCategoriesRemove")}
          </Label>
          <ChipGroup
            options={categories}
            selectedIds={selectedCategoryIds}
            onToggle={toggleCategoryAction}
            labelFor={(c) => c.pathName}
            emptyMessage={t("noCategoriesFound")}
            maxHeightClass="max-h-48"
          />
          {selectedCategoryIds.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {t("categoriesSelected", { count: selectedCategoryIds.length })}
            </p>
          )}
        </div>
      )}

      {isTagMultiSelectAction && (
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs text-muted-foreground">
            {action.type === "setTagsReplace"
              ? t("pickTagsReplace")
              : action.type === "addTags"
              ? t("pickTagsAdd")
              : t("pickTagsRemove")}
          </Label>
          <ChipGroup
            options={tags}
            selectedIds={selectedTagIds}
            onToggle={toggleTagAction}
            labelFor={(tg) => tg.name}
            emptyMessage={t("noTagsFound")}
            maxHeightClass="max-h-48"
          />
          {selectedTagIds.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {t("tagsSelected", { count: selectedTagIds.length })}
            </p>
          )}
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
          <PriceInput
            className="w-64"
            value={(action.value as number) ?? 0}
            rates={rates}
            defaultCurrency={currency}
            onChange={(usd) => onChangeValue(usd)}
            aria-invalid={!!valueError}
          />
          {valueError && (
            <p className="text-xs text-destructive">{t(valueError)}</p>
          )}
        </div>
      )}

      {action.type === "setStock" && (
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs text-muted-foreground">{t("newStock")}</Label>
          <NumberStepper
            min={0}
            className="h-8 text-sm w-36"
            value={(action.value as number) ?? 0}
            onChange={(v) => onChangeValue(v ?? 0)}
            aria-invalid={!!valueError}
          />
          {valueError ? (
            <p className="text-xs text-destructive">{t(valueError)}</p>
          ) : (
            <p className="text-xs text-muted-foreground">{t("stockSimpleOnlyHint")}</p>
          )}
        </div>
      )}

      {action.type === "setWarrantyMonths" && (
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs text-muted-foreground">{t("newWarrantyMonths")}</Label>
          <NumberStepper
            min={0}
            max={MAX_WARRANTY_MONTHS}
            allowEmpty
            placeholder={t("newWarrantyPlaceholder")}
            className="h-8 text-sm w-36"
            value={(action.value as number | null) ?? null}
            onChange={(v) => onChangeValue(v)}
            aria-invalid={!!valueError}
          />
          {valueError ? (
            <p className="text-xs text-destructive">
              {t("warrantyOutOfRange", { max: MAX_WARRANTY_MONTHS })}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">{t("warrantyZeroHint")}</p>
          )}
        </div>
      )}

      {action.type === "setCountryOfOrigin" && (
        <div className="flex flex-col gap-1.5 w-64">
          <Label className="text-xs text-muted-foreground">{t("newCountryOfOrigin")}</Label>
          <CountrySelect
            value={(action.value as string) ?? null}
            onChange={(code) => onChangeValue(code)}
          />
        </div>
      )}

      {isBoolAction && (
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs text-muted-foreground">{t("valueLabel")}</Label>
          <Select
            value={action.value === true ? "true" : "false"}
            onValueChange={(v) => onChangeValue(v === "true")}
          >
            <SelectTrigger className="w-28">
              <SelectValue>{action.value === true ? t("yes") : t("no")}</SelectValue>
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
  const { currency, currentRate } = useCurrencyStore();
  const STATUS_LABELS: Record<string, string> = {
    DRAFT: t("draft"),
    PUBLISHED: t("published"),
    ARCHIVED: t("archived"),
  };
  return (
    <div className="rounded-lg border bg-muted/20 p-4 flex flex-col gap-3">
      <p className="text-sm font-semibold">
        {preview.count === 0
          ? t("noMatch")
          : t("willAffect", { count: preview.count })}
      </p>
      {preview.samples.length > 0 && (
        <div className="rounded border overflow-x-auto">
          <table className="w-full min-w-125 text-xs">
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
                  <td className="px-3 py-1.5">{formatPrice(convertCents(p.price, currency, currentRate()), currency)}</td>
                  <td className="px-3 py-1.5">
                    <Badge variant={getStatusVariant(p.status)} className="text-[10px]">
                      {STATUS_LABELS[p.status] ?? p.status}
                    </Badge>
                  </td>
                  <td className="px-3 py-1.5 text-muted-foreground">
                    {p.brand?.name ?? "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {preview.count > preview.samples.length && (
            <p className="min-w-125 px-3 py-1.5 text-xs text-muted-foreground border-t">
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
    case "category": return { type: "category", categoryIds: [] };
    case "noCategory": return { type: "noCategory" };
    case "tag": return { type: "tag", tagIds: [] };
    case "noTag": return { type: "noTag" };
    case "status": return { type: "status", statuses: [] };
    case "minPrice": return { type: "minPrice", value: 0 };
    case "maxPrice": return { type: "maxPrice", value: 0 };
    case "minStock": return { type: "minStock", value: 0 };
    case "maxStock": return { type: "maxStock", value: 0 };
    case "outOfStock": return { type: "outOfStock" };
    case "taxable": return { type: "taxable", value: true };
    case "requiresShipping": return { type: "requiresShipping", value: true };
    case "isDigital": return { type: "isDigital", value: true };
    case "countryOfOrigin": return { type: "countryOfOrigin", codes: [] };
    case "noCountryOfOrigin": return { type: "noCountryOfOrigin" };
    case "minWarrantyMonths": return { type: "minWarrantyMonths", value: 0 };
    case "maxWarrantyMonths": return { type: "maxWarrantyMonths", value: 0 };
    case "noWarranty": return { type: "noWarranty" };
    case "titleContains": return { type: "titleContains", value: "" };
  }
}

export function ConditionalBulkPanel({
  brands,
  categories,
  tags,
}: {
  brands: BrandOption[];
  categories: CategoryOption[];
  tags: TagOption[];
}) {
  const t = useTranslations("bulkProducts");
  const tCommon = useTranslations("common");
  const queryClient = useQueryClient();

  const ADDABLE_CONDITIONS: { type: ConditionType; label: string }[] = [
    { type: "brand", label: t("condBrand") },
    { type: "noBrand", label: t("condNoBrand") },
    { type: "category", label: t("condCategory") },
    { type: "noCategory", label: t("condNoCategory") },
    { type: "tag", label: t("condTag") },
    { type: "noTag", label: t("condNoTag") },
    { type: "status", label: t("condStatus") },
    { type: "minPrice", label: t("condMinPrice") },
    { type: "maxPrice", label: t("condMaxPrice") },
    { type: "minStock", label: t("condMinStock") },
    { type: "maxStock", label: t("condMaxStock") },
    { type: "outOfStock", label: t("condOutOfStock") },
    { type: "taxable", label: t("condTaxable") },
    { type: "requiresShipping", label: t("condRequiresShipping") },
    { type: "isDigital", label: t("condIsDigital") },
    { type: "countryOfOrigin", label: t("condCountryOfOrigin") },
    { type: "noCountryOfOrigin", label: t("condNoCountryOfOrigin") },
    { type: "minWarrantyMonths", label: t("condMinWarrantyMonths") },
    { type: "maxWarrantyMonths", label: t("condMaxWarrantyMonths") },
    { type: "noWarranty", label: t("condNoWarranty") },
    { type: "titleContains", label: t("condTitleContains") },
  ];

  const [conditions, setConditions] = useState<Condition[]>([]);
  const [action, setAction] = useState<{
    type: ActionType;
    value?: string | number | boolean | null | string[];
  }>({ type: "setStatus", value: "DRAFT" });
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [isPreviewing, startPreview] = useTransition();
  const [isExecuting, startExecute] = useTransition();
  const [lastResult, setLastResult] = useState<{ count: number; message: string } | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const wasExecuting = useRef(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (wasExecuting.current && !isExecuting) setConfirmOpen(false);
    wasExecuting.current = isExecuting;
  }, [isExecuting]);

  const addCondition = (type: ConditionType) => {
    if (conditions.some((c) => c.type === type)) return;
    const partners = MUTEX_PARTNERS[type] ?? [];
    if (partners.some((p) => conditions.some((c) => c.type === p))) return;
    setConditions((prev) => [...prev, makeDefaultCondition(type)]);
    setPreview(null);
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
      case "setStatus":
        return { status: action.value as ProductStatus };
      case "setBrand":
        return { brandId: action.value as string };
      case "removeBrand":
        return { brandId: null };
      case "setCategoriesReplace":
        return { categories: { mode: "set", ids: (action.value as string[]) ?? [] } };
      case "addCategories":
        return { categories: { mode: "add", ids: (action.value as string[]) ?? [] } };
      case "removeCategories":
        return { categories: { mode: "remove", ids: (action.value as string[]) ?? [] } };
      case "clearCategories":
        return { categories: { mode: "set", ids: [] } };
      case "setTagsReplace":
        return { tags: { mode: "set", ids: (action.value as string[]) ?? [] } };
      case "addTags":
        return { tags: { mode: "add", ids: (action.value as string[]) ?? [] } };
      case "removeTags":
        return { tags: { mode: "remove", ids: (action.value as string[]) ?? [] } };
      case "clearTags":
        return { tags: { mode: "set", ids: [] } };
      case "setPrice":
        return { price: action.value as number };
      case "setCompareAtPrice":
        return { compareAtPrice: (action.value as number) > 0 ? (action.value as number) : null };
      case "setCostPrice":
        return { costPrice: (action.value as number) > 0 ? (action.value as number) : null };
      case "setStock":
        return { stock: action.value as number };
      case "setTaxable":
        return { taxable: action.value as boolean };
      case "setRequiresShipping":
        return { requiresShipping: action.value as boolean };
      case "setIsDigital":
        return { isDigital: action.value as boolean };
      case "setWarrantyMonths":
        return { warrantyMonths: action.value as number };
      // Clearing is its own action rather than "set to empty": 0 months is a
      // real value ("no warranty"), so it cannot double as "unspecified".
      case "clearWarrantyMonths":
        return { warrantyMonths: null };
      case "setCountryOfOrigin":
        return { countryOfOrigin: action.value as string };
      case "clearCountryOfOrigin":
        return { countryOfOrigin: null };
      default:
        return {};
    }
  };

  const isActionValid = (): boolean => {
    if (
      action.type === "delete" ||
      action.type === "removeBrand" ||
      action.type === "clearCategories" ||
      action.type === "clearTags"
    ) return true;
    if (action.type === "setStatus") return !!action.value;
    if (action.type === "setBrand") return !!action.value;
    if (action.type === "setCategoriesReplace") return Array.isArray(action.value);
    if (action.type === "addCategories" || action.type === "removeCategories") {
      return Array.isArray(action.value) && (action.value as string[]).length > 0;
    }
    if (action.type === "setTagsReplace") return Array.isArray(action.value);
    if (action.type === "addTags" || action.type === "removeTags") {
      return Array.isArray(action.value) && (action.value as string[]).length > 0;
    }
    if (action.type === "setPrice") return (action.value as number) > 0;
    if (action.type === "setCompareAtPrice" || action.type === "setCostPrice") return action.value !== undefined;
    if (action.type === "setStock") return action.value !== undefined && (action.value as number) >= 0;
    if (action.type === "setTaxable" || action.type === "setRequiresShipping" || action.type === "setIsDigital") {
      return action.value !== undefined;
    }
    if (action.type === "setWarrantyMonths") {
      const months = action.value as number;
      return (
        action.value !== undefined &&
        Number.isInteger(months) &&
        months >= 0 &&
        months <= MAX_WARRANTY_MONTHS
      );
    }
    if (action.type === "setCountryOfOrigin") return typeof action.value === "string" && !!action.value;
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

      // bulkUpdateByFilter returns `skippedWithVariants` for stock writes; the
      // delete action doesn't, so default it to 0 for that branch.
      const ok = res as {
        error: false;
        count: number;
        message: string;
        skippedWithVariants?: number;
      };
      setLastResult({ count: ok.count, message: ok.message });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setPreview(null);

      if (action.type === "delete") {
        // Clear conditions after a successful delete so user doesn't accidentally re-run
        setConditions([]);
      }

      // Surface "no-op because all matches had variants" as a warning, not a
      // success, so users notice rather than thinking the write went through.
      if (ok.count === 0 && (ok.skippedWithVariants ?? 0) > 0) {
        toast.warning(ok.message);
      } else {
        toast.success(ok.message);
      }
    });
  };

  const hasConditions = conditions.length > 0;
  const effectivePreviewCount = preview?.count ?? 0;

  // Category/tag writes rebuild search text per product (N+1 in-txn), so the
  // server caps how many a single filter run may touch. Mirror that cap here
  // so the user sees it before executing instead of hitting a server error.
  const isCategoryMutationAction =
    action.type === "setCategoriesReplace" ||
    action.type === "addCategories" ||
    action.type === "removeCategories" ||
    action.type === "clearCategories" ||
    action.type === "setTagsReplace" ||
    action.type === "addTags" ||
    action.type === "removeTags" ||
    action.type === "clearTags";
  const exceedsBulkCategoryLimit =
    isCategoryMutationAction && effectivePreviewCount > BULK_CATEGORY_MUTATION_LIMIT;

  const canExecute =
    hasConditions &&
    isActionValid() &&
    actionValueError(action.type, action.value) === null &&
    preview !== null &&
    effectivePreviewCount > 0 &&
    !exceedsBulkCategoryLimit;

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
            categories={categories}
            tags={tags}
            onUpdate={(c) => updateCondition(i, c)}
            onRemove={() => removeCondition(i)}
          />
        ))}

        {/* Add condition menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="w-fit gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              {t("addCondition")}
              <ChevronDown className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-72 max-h-80">
            {ADDABLE_CONDITIONS.map(({ type, label }) => {
              const alreadyAdded = existingTypes.has(type);
              const partners = MUTEX_PARTNERS[type] ?? [];
              const blockingPartner = partners.find((p) => existingTypes.has(p));
              const disabled = alreadyAdded || !!blockingPartner;
              // Surface *why* the item is unavailable so users aren't left
              // wondering why their click did nothing.
              const reasonLabel = alreadyAdded
                ? t("added")
                : blockingPartner
                ? t("conflictsWith", {
                    condition:
                      ADDABLE_CONDITIONS.find((c) => c.type === blockingPartner)?.label ?? "",
                  })
                : null;
              return (
                <DropdownMenuItem
                  key={type}
                  disabled={disabled}
                  onSelect={() => addCondition(type)}
                  title={reasonLabel ?? undefined}
                >
                  <span className="truncate">{label}</span>
                  {reasonLabel && (
                    <span className="ml-auto text-[10px] uppercase tracking-wide text-muted-foreground shrink-0">
                      {reasonLabel}
                    </span>
                  )}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Separator />

      {/* ── Action ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold">{t("chooseAction")}</h3>
        <ActionEditor
          action={action}
          onChangeType={(type) => {
            // Pick a sensible default value per action so the UI never starts in an invalid state.
            const defaultValue =
              type === "setTaxable" || type === "setRequiresShipping" || type === "setIsDigital"
                ? true
                : type === "setCategoriesReplace" ||
                  type === "addCategories" ||
                  type === "removeCategories" ||
                  type === "setTagsReplace" ||
                  type === "addTags" ||
                  type === "removeTags"
                ? []
                : type === "setStock"
                ? 0
                : undefined;
            setAction({ type, value: defaultValue });
          }}
          onChangeValue={(v) => setAction((prev) => ({ ...prev, value: v }))}
          brands={brands}
          categories={categories}
          tags={tags}
        />
      </div>

      <Separator />

      {/* ── Preview ────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold">{t("previewExecute")}</h3>

        {/* Gated on having conditions: without them the preview would count the
            whole catalogue, which reads as "this is what I am about to change"
            while executing is in fact blocked (`canExecute` needs a condition).
            Disabled + a reason instead, same contract as every admin form. */}
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            className="w-fit gap-2"
            onClick={handlePreview}
            disabled={isPreviewing || !hasConditions}
          >
            {isPreviewing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Search className="h-3.5 w-3.5" />
            )}
            {isPreviewing ? t("previewing") : t("previewBtn")}
          </Button>
          <SaveBlockedNotice
            blocked={!hasConditions}
            reason={t("addConditionFirst")}
          />
        </div>

        {preview && <PreviewCard preview={preview} />}

        {exceedsBulkCategoryLimit && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>{t("bulkCategoryLimitTitle")}</AlertTitle>
            <AlertDescription>
              {t("bulkCategoryLimitDesc", {
                count: effectivePreviewCount,
                limit: BULK_CATEGORY_MUTATION_LIMIT,
              })}
            </AlertDescription>
          </Alert>
        )}

        {lastResult && (
          <Alert>
            <CheckCircle2 className="h-4 w-4" />
            <AlertTitle>{t("done")}</AlertTitle>
            <AlertDescription>{lastResult.message}</AlertDescription>
          </Alert>
        )}

        {/* Execute button + confirm dialog */}
        {preview !== null && (
          <AlertDialog
            open={confirmOpen}
            onOpenChange={(next) => {
              if (isExecuting) return;
              setConfirmOpen(next);
            }}
          >
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
                  : !hasConditions
                  ? t("addConditionFirst")
                  : effectivePreviewCount === 0
                  ? t("noProductsToUpdate")
                  : actionValueError(action.type, action.value)
                  ? t("fixActionValue")
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
                <AlertDialogCancel disabled={isExecuting}>{tCommon("cancel")}</AlertDialogCancel>
                <AlertDialogAction
                  onClick={(e) => {
                    e.preventDefault();
                    handleExecute();
                  }}
                  disabled={isExecuting}
                  variant={action.type === "delete" ? "destructiveSolid" : "default"}
                >
                  {isExecuting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {t("executing")}
                    </>
                  ) : (
                    confirmLabel()
                  )}
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
