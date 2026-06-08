"use client";

import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useWatch, type UseFormReturn } from "react-hook-form";
import type { ProductFormData } from "./ProductForm";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getLabel } from "@/features/attributes/utils/translations";
import type { AttributeSelectorItem } from "@/features/attributes/db/attributes";
import type { CategoryTreeItem } from "@/features/categories/db/categories";

const NONE = "__none__";

type AttributeValueEntry = ProductFormData["attributes"][number];

type AttrForm = UseFormReturn<ProductFormData, unknown, ProductFormData>;

/** Walks the nested category tree to a flat id -> parentId map + node lookup. */
function indexTree(tree: CategoryTreeItem[]) {
  const parentOf = new Map<string, string | null>();
  const nodeById = new Map<string, CategoryTreeItem>();
  const walk = (node: CategoryTreeItem, parentId: string | null) => {
    parentOf.set(node.id, parentId);
    nodeById.set(node.id, node);
    for (const child of node.children) walk(child, node.id);
  };
  for (const root of tree) walk(root, null);
  return { parentOf, nodeById };
}

/**
 * Product form section that renders an input per attribute applicable to the
 * currently selected categories (own + inherited from ancestor departments).
 * Captures values into the form's `attributes` array.
 */
export function ProductAttributesField({
  form,
  attributeLibrary,
  categoryAttributeMap,
  categoryTree,
}: {
  form: AttrForm;
  attributeLibrary: AttributeSelectorItem[];
  categoryAttributeMap: Record<string, string[]>;
  categoryTree: CategoryTreeItem[];
}) {
  const t = useTranslations("productForm");
  const locale = useLocale();

  const categoryIdsRaw = useWatch({ control: form.control, name: "categoryIds" });
  const categoryIds = useMemo(
    () => (categoryIdsRaw as string[] | undefined) ?? [],
    [categoryIdsRaw],
  );
  const entries =
    (useWatch({ control: form.control, name: "attributes" }) as
      | AttributeValueEntry[]
      | undefined) ?? [];

  const { parentOf } = useMemo(() => indexTree(categoryTree), [categoryTree]);

  // Resolve the applicable attributes: union of every selected category's own
  // attributes plus all their ancestors', ordered by the library order.
  const applicable = useMemo(() => {
    const ids = new Set<string>();
    for (const catId of categoryIds) {
      let current: string | null = catId;
      const guard = new Set<string>();
      while (current && !guard.has(current)) {
        guard.add(current);
        for (const attrId of categoryAttributeMap[current] ?? []) ids.add(attrId);
        current = parentOf.get(current) ?? null;
      }
    }
    // Variant-defining attributes (Color, Size...) are captured per-variant in
    // the Variants tab, not as product-level values - exclude them here.
    return attributeLibrary.filter((a) => ids.has(a.id) && !a.isVariantDefining);
  }, [categoryIds, categoryAttributeMap, parentOf, attributeLibrary]);

  if (applicable.length === 0) return null;

  const entryFor = (attributeId: string): AttributeValueEntry | undefined =>
    entries.find((e) => e.attributeId === attributeId);

  const patchEntry = (
    attributeId: string,
    patch: Partial<Omit<AttributeValueEntry, "attributeId">>,
  ) => {
    const current = form.getValues("attributes") ?? [];
    const idx = current.findIndex((e) => e.attributeId === attributeId);
    const base: AttributeValueEntry =
      idx >= 0
        ? current[idx]
        : { attributeId, optionIds: [], valueNumeric: null, valueBool: null };
    const merged: AttributeValueEntry = { ...base, ...patch, attributeId };
    const isEmpty =
      merged.optionIds.length === 0 &&
      merged.valueNumeric == null &&
      merged.valueBool == null;

    let next: AttributeValueEntry[];
    if (idx >= 0) {
      next = [...current];
      if (isEmpty) next.splice(idx, 1);
      else next[idx] = merged;
    } else {
      next = isEmpty ? current : [...current, merged];
    }
    form.setValue("attributes", next, { shouldDirty: true });
  };

  return (
    <div className="space-y-4 rounded-lg border border-border/60 p-4">
      <div>
        <p className="text-sm font-semibold">{t("attributesTitle")}</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {t("attributesDesc")}
        </p>
      </div>

      <div className="space-y-4">
        {applicable.map((attr) => {
          const label = getLabel(attr.translations, locale);
          const entry = entryFor(attr.id);

          return (
            <div key={attr.id} className="space-y-2">
              <label className="block text-sm font-medium">
                {label}
                {attr.type === "RANGE" && attr.unit && (
                  <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                    ({attr.unit})
                  </span>
                )}
              </label>

              {/* SELECT */}
              {attr.type === "SELECT" && (
                <Select
                  value={entry?.optionIds[0] ?? NONE}
                  onValueChange={(v) =>
                    patchEntry(attr.id, { optionIds: v === NONE ? [] : [v] })
                  }
                >
                  <SelectTrigger className="w-full sm:w-72">
                    <SelectValue placeholder={t("attributeSelectPlaceholder")} />
                  </SelectTrigger>
                  <SelectContent position="popper" className="max-h-72">
                    <SelectItem value={NONE}>
                      {t("attributeNone")}
                    </SelectItem>
                    {attr.options.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {getLabel(o.translations, locale)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {/* MULTI_SELECT */}
              {attr.type === "MULTI_SELECT" && (
                <div className="flex flex-wrap gap-x-4 gap-y-2 pt-1">
                  {attr.options.map((o) => {
                    const checked = entry?.optionIds.includes(o.id) ?? false;
                    return (
                      <label
                        key={o.id}
                        className="flex items-center gap-2 text-sm cursor-pointer text-muted-foreground hover:text-foreground"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() => {
                            const cur = entry?.optionIds ?? [];
                            const nextIds = checked
                              ? cur.filter((id) => id !== o.id)
                              : [...cur, o.id];
                            patchEntry(attr.id, { optionIds: nextIds });
                          }}
                        />
                        {getLabel(o.translations, locale)}
                      </label>
                    );
                  })}
                </div>
              )}

              {/* RANGE */}
              {attr.type === "RANGE" && (
                <Input
                  type="number"
                  inputMode="decimal"
                  placeholder={t("attributeRangePlaceholder")}
                  className="w-full sm:w-48"
                  value={entry?.valueNumeric ?? ""}
                  onChange={(e) =>
                    patchEntry(attr.id, {
                      valueNumeric:
                        e.target.value === "" ? null : Number(e.target.value),
                    })
                  }
                />
              )}

              {/* BOOLEAN */}
              {attr.type === "BOOLEAN" && (
                <div className="flex items-center gap-2 pt-0.5">
                  <Switch
                    checked={entry?.valueBool === true}
                    onCheckedChange={(v) =>
                      patchEntry(attr.id, { valueBool: v ? true : null })
                    }
                  />
                  <span className="text-xs text-muted-foreground">
                    {t("attributeYes")}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
