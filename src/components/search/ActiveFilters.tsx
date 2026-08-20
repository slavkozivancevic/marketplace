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
          // Hover mixes the chip's OWN rest colour toward --foreground instead
          // of washing `bg-muted` over it. The old `hover:bg-muted/70` landed
          // at roughly oklch(0.912) in the light theme - below the page's 0.94 -
          // so the chip flipped from raised (bg-card, 0.975) to recessed in one
          // step and read as a harsh slam to dark. Mixing toward the foreground
          // moves the same distance in every theme and automatically picks the
          // right direction: darker on light, lighter on dark. Same reasoning as
          // the button variants' color-mix ladder.
          className="gap-1 pr-1 cursor-pointer border-border/60 bg-card text-card-foreground hover:bg-[color-mix(in_oklab,var(--card)_96%,var(--foreground))] transition-colors"
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
