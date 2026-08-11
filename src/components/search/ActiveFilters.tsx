"use client";

import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import type { FilterGroup, FilterValues } from "./FilterSidebar";

interface ActiveFiltersProps {
  groups: FilterGroup[];
  values: FilterValues;
  onRemove: (key: string, value?: string) => void;
  onClearAll: () => void;
}

export function ActiveFilters({
  groups,
  values,
  onRemove,
  onClearAll,
}: ActiveFiltersProps) {
  const t = useTranslations("search");
  const chips: { key: string; value: string; label: string }[] = [];

  for (const group of groups) {
    const val = values[group.key];
    if (!val) continue;

    if (group.type === "checkbox" && Array.isArray(val)) {
      for (const v of val as string[]) {
        const option = group.options.find((o) => o.value === v);
        chips.push({
          key: group.key,
          value: v,
          label: `${group.label}: ${option?.label ?? v}`,
        });
      }
    }

    if (group.type === "range") {
      const [min, max] = val as [number?, number?];
      if (min != null || max != null) {
        const prefix = group.prefix ?? "";
        let label = group.label + ": ";
        if (min != null && max != null) {
          label += `${prefix}${min} - ${prefix}${max}`;
        } else if (min != null) {
          label += `${prefix}${min}+`;
        } else {
          label += `${t("to")} ${prefix}${max}`;
        }
        chips.push({ key: group.key, value: "__range__", label });
      }
    }

    if (group.type === "rating" && typeof val === "number" && val > 0) {
      chips.push({
        key: group.key,
        value: "__rating__",
        label: `${group.label}: ${val}★ ${t("andUp")}`,
      });
    }
  }

  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {chips.map((chip) => (
        <Badge
          key={`${chip.key}-${chip.value}`}
          variant="secondary"
          className="gap-1 pr-1 cursor-pointer border-border/60 bg-card text-card-foreground hover:bg-muted/70 transition-colors"
          onClick={() =>
            chip.value === "__range__"
              ? onRemove(chip.key)
              : onRemove(chip.key, chip.value)
          }
        >
          {chip.label}
          <X className="size-3" />
        </Badge>
      ))}
      {chips.length > 1 && (
        <button
          type="button"
          onClick={onClearAll}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors underline cursor-pointer"
        >
          {t("clearAll")}
        </button>
      )}
    </div>
  );
}
