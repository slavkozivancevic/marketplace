"use client";

import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useFieldArray, useWatch, type useForm } from "react-hook-form";
import { Lock, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { NumberStepper } from "@/components/ui/number-stepper";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CategoryInput } from "../schema/categories";
import { getCategoryName } from "../utils/translations";
import { getAttributeLabel } from "@/features/attributes/utils/translations";
import { ChangedHint } from "@/components/forms/ChangedHint";
import { useChangedHintEnabled } from "@/components/forms/FieldChangedHint";
import { useBoolFormat } from "@/lib/forms/changedFormatters";
import type { AttributeLibraryItem } from "@/features/attributes/db/attributes";

type ParentOption = {
  id: string;
  parentId: string | null;
  translations: { locale: string; name: string; slug: string; description: string | null }[];
};

/**
 * Category form section for assigning filterable attributes. Shows attributes
 * inherited from the selected parent chain (read-only) plus this category's own
 * assignments, which the admin can add / remove and toggle filterable.
 */
export function CategoryAttributesField({
  form,
  attributeLibrary,
  categoryAttributeMap,
  parentOptions,
}: {
  form: ReturnType<typeof useForm<CategoryInput>>;
  attributeLibrary: AttributeLibraryItem[];
  categoryAttributeMap: Record<string, string[]>;
  parentOptions: ParentOption[];
}) {
  const t = useTranslations("adminCategories");
  const tAttr = useTranslations("adminAttributes");
  const boolFmt = useBoolFormat();
  const locale = useLocale();

  const parentId = useWatch({ control: form.control, name: "parentId" });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "attributes",
  });

  // Reactive view of the assigned attributes. `form.watch(...)` called inside the
  // row map did NOT re-render on `setValue` (the order/filterable controls froze,
  // while delete worked because useFieldArray re-renders). A single top-level
  // useWatch makes the rows reflect their current values.
  const watchedAttributes = useWatch({ control: form.control, name: "attributes" });

  const libraryById = useMemo(
    () => new Map(attributeLibrary.map((a) => [a.id, a])),
    [attributeLibrary],
  );

  const parentById = useMemo(
    () => new Map(parentOptions.map((p) => [p.id, p])),
    [parentOptions],
  );

  // Walk the parent chain and union every ancestor's directly-assigned
  // attributes - those are inherited and shown read-only.
  const inherited = useMemo(() => {
    const seen = new Set<string>();
    const result: { attribute: AttributeLibraryItem; from: string }[] = [];
    let current = parentId ? parentById.get(parentId) : undefined;
    const guard = new Set<string>();
    while (current && !guard.has(current.id)) {
      guard.add(current.id);
      const ancestorName = getCategoryName(current, locale);
      for (const attrId of categoryAttributeMap[current.id] ?? []) {
        const attribute = libraryById.get(attrId);
        if (attribute && !seen.has(attrId)) {
          seen.add(attrId);
          result.push({ attribute, from: ancestorName });
        }
      }
      current = current.parentId ? parentById.get(current.parentId) : undefined;
    }
    return result;
  }, [parentId, parentById, categoryAttributeMap, libraryById, locale]);

  const inheritedIds = useMemo(
    () => new Set(inherited.map((i) => i.attribute.id)),
    [inherited],
  );

  const ownIds = useMemo(
    () => new Set(fields.map((f) => f.attributeId)),
    [fields],
  );

  // Available to add: not already inherited and not already assigned here.
  const available = attributeLibrary.filter(
    (a) => !inheritedIds.has(a.id) && !ownIds.has(a.id),
  );

  const addAttribute = (attributeId: string) => {
    append({ attributeId, order: fields.length, isFilterable: true });
  };

  // Saved baseline per assigned attribute, so each row can show its persisted
  // order / filterable when edited. Empty in create mode; newly-added rows have
  // no saved match and show no hint.
  type SavedAssign = { attributeId?: string; order?: number; isFilterable?: boolean };
  const savedByAttr = new Map<string, SavedAssign>();
  for (const s of (form.formState.defaultValues?.attributes ?? []) as SavedAssign[]) {
    if (s?.attributeId) savedByAttr.set(s.attributeId, s);
  }

  // Show change indicators only in edit mode (a saved baseline exists). On the
  // section header, flag any add / remove / order / filterable change.
  const changedEnabled = useChangedHintEnabled();
  const currentAttrIds = new Set(fields.map((f) => f.attributeId));
  // Render order: walk the SAVED order first (each still-present attr rendered
  // in place, each removed attr shown struck-through in its original spot), then
  // append newly-added attrs at the end. This keeps a deleted middle filter from
  // jumping to the bottom. In create mode (no saved baseline) everything falls
  // through to the "added" pass, preserving insertion order.
  const fieldIndexByAttrId = new Map(fields.map((f, i) => [f.attributeId, i] as const));
  const orderedRows: Array<
    | { kind: "active"; index: number }
    | { kind: "removed"; id: string; saved: SavedAssign }
  > = [];
  for (const [id, saved] of savedByAttr.entries()) {
    const idx = fieldIndexByAttrId.get(id);
    if (idx !== undefined) orderedRows.push({ kind: "active", index: idx });
    else if (changedEnabled) orderedRows.push({ kind: "removed", id, saved });
  }
  fields.forEach((f, i) => {
    if (!savedByAttr.has(f.attributeId)) orderedRows.push({ kind: "active", index: i });
  });
  const sectionChanged =
    changedEnabled &&
    (fields.some((f) => !savedByAttr.has(f.attributeId)) ||
      [...savedByAttr.keys()].some((id) => !currentAttrIds.has(id)) ||
      fields.some((f, i) => {
        const s = savedByAttr.get(f.attributeId);
        if (!s) return false;
        const o = watchedAttributes?.[i]?.order ?? f.order;
        const fl = watchedAttributes?.[i]?.isFilterable ?? f.isFilterable;
        return s.order !== o || s.isFilterable !== fl;
      }));

  return (
    <div className="rounded-lg border border-border/60 p-4 space-y-4">
      <div>
        <p className="text-sm font-medium flex items-center gap-1.5">
          {t("attributesTitle")}
          {sectionChanged && (
            <span className="size-1.5 rounded-full bg-amber-500" aria-hidden />
          )}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {t("attributesDesc")}
        </p>
      </div>

      {/* Inherited (read-only) */}
      {inherited.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">
            {t("inheritedAttributes")}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {inherited.map(({ attribute, from }) => (
              <Badge
                key={attribute.id}
                variant="secondary"
                className="gap-1 font-normal"
                title={t("inheritedFrom", { name: from })}
              >
                <Lock className="h-3 w-3 opacity-60" />
                {getAttributeLabel(attribute, locale)}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Own assignments (saved order; removed shown struck-through in place) */}
      {orderedRows.length > 0 && (
        <div className="space-y-2">
          {orderedRows.map((row) => {
            if (row.kind === "removed") {
              const attribute = libraryById.get(row.id);
              return (
                <div
                  key={`removed-${row.id}`}
                  className="flex items-center gap-3 rounded-lg border border-dashed border-border/60 p-2.5"
                >
                  <span className="flex-1 min-w-0 truncate text-sm font-medium text-muted-foreground line-through">
                    {attribute ? getAttributeLabel(attribute, locale) : row.id}
                  </span>
                  <span className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-500 shrink-0">
                    <span className="size-1.5 rounded-full bg-amber-500" aria-hidden />
                    {t("removed")}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    onClick={() =>
                      append({
                        attributeId: row.id,
                        order: row.saved.order ?? 0,
                        isFilterable: row.saved.isFilterable ?? true,
                      })
                    }
                  >
                    {t("undo")}
                  </Button>
                </div>
              );
            }

            const index = row.index;
            const field = fields[index];
            const attribute = libraryById.get(field.attributeId);
            const order = watchedAttributes?.[index]?.order ?? field.order;
            const isFilterable =
              watchedAttributes?.[index]?.isFilterable ?? field.isFilterable;
            const saved = savedByAttr.get(field.attributeId);
            const savedParts: string[] = [];
            if (saved) {
              if (saved.order !== order) {
                savedParts.push(`${t("order")}: ${saved.order}`);
              }
              if (saved.isFilterable !== isFilterable) {
                savedParts.push(`${t("filterable")}: ${boolFmt(saved.isFilterable)}`);
              }
            }
            return (
              <div
                key={field.id}
                className="rounded-lg border border-border/60 p-2.5 space-y-1.5"
              >
                <div className="flex items-center gap-3">
                <span className="flex-1 min-w-0 truncate text-sm font-medium">
                  {attribute ? getAttributeLabel(attribute, locale) : field.attributeId}
                  {attribute && (
                    <Badge variant="outline" className="ml-2 text-[10px] font-normal">
                      {tAttr(`type_${attribute.type}`)}
                    </Badge>
                  )}
                </span>

                {/* Order */}
                <NumberStepper
                  min={0}
                  className="w-16"
                  value={order}
                  onChange={(v) =>
                    form.setValue(`attributes.${index}.order`, v ?? 0, { shouldDirty: true })
                  }
                />

                {/* Filterable toggle */}
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
                  <Switch
                    checked={isFilterable}
                    onCheckedChange={(v) =>
                      form.setValue(`attributes.${index}.isFilterable`, v, {
                        shouldDirty: true,
                      })
                    }
                  />
                  {t("filterable")}
                </label>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => remove(index)}
                  className="shrink-0"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                  <span className="sr-only">{t("removeAttribute")}</span>
                </Button>
                </div>
                {changedEnabled && !saved && (
                  <p className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-500">
                    <span className="size-1.5 shrink-0 rounded-full bg-amber-500" aria-hidden />
                    {t("added")}
                  </p>
                )}
                {saved && savedParts.length > 0 && (
                  <ChangedHint changed savedText={savedParts.join(", ")} />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add picker */}
      {available.length > 0 ? (
        <Select value="" onValueChange={addAttribute}>
          <SelectTrigger className="w-full">
            <span className="flex items-center gap-2 text-muted-foreground">
              <Plus className="h-3.5 w-3.5" />
              <SelectValue placeholder={t("addAttributeFilter")} />
            </span>
          </SelectTrigger>
          <SelectContent position="popper" className="max-h-72">
            {available.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {getAttributeLabel(a, locale)}
                <span className="ml-2 text-xs text-muted-foreground">
                  {tAttr(`type_${a.type}`)}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        fields.length === 0 &&
        inherited.length === 0 && (
          <p className="text-sm text-muted-foreground rounded-lg border border-dashed p-3 text-center">
            {t("noAttributesAvailable")}
          </p>
        )
      )}
    </div>
  );
}
