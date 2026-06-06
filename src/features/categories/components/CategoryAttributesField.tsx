"use client";

import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useFieldArray, useWatch, type useForm } from "react-hook-form";
import { Lock, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
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
  const locale = useLocale();

  const parentId = useWatch({ control: form.control, name: "parentId" });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "attributes",
  });

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

  return (
    <div className="rounded-lg border border-border/60 p-4 space-y-4">
      <div>
        <p className="text-sm font-medium">{t("attributesTitle")}</p>
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

      {/* Own assignments */}
      {fields.length > 0 && (
        <div className="space-y-2">
          {fields.map((field, index) => {
            const attribute = libraryById.get(field.attributeId);
            return (
              <div
                key={field.id}
                className="flex items-center gap-3 rounded-lg border border-border/60 p-2.5"
              >
                <span className="flex-1 min-w-0 truncate text-sm font-medium">
                  {attribute ? getAttributeLabel(attribute, locale) : field.attributeId}
                  {attribute && (
                    <Badge variant="outline" className="ml-2 text-[10px] font-normal">
                      {tAttr(`type_${attribute.type}`)}
                    </Badge>
                  )}
                </span>

                {/* Order */}
                <Input
                  type="number"
                  min={0}
                  className="w-16 h-8"
                  {...form.register(`attributes.${index}.order`, {
                    valueAsNumber: true,
                  })}
                  title={t("attributeOrder")}
                />

                {/* Filterable toggle */}
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
                  <Switch
                    checked={form.watch(`attributes.${index}.isFilterable`)}
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
