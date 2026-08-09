"use client";

import { useTranslations } from "next-intl";
import { ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface SortOption {
  value: string;
  label: string;
}

interface SortSelectProps {
  sortBy: string;
  sortOrder: "asc" | "desc";
  onSortByChange: (value: string) => void;
  onSortOrderChange: (value: "asc" | "desc") => void;
  options: SortOption[];
  triggerClassName?: string;
}

export function SortSelect({
  sortBy,
  sortOrder,
  onSortByChange,
  onSortOrderChange,
  options,
  triggerClassName,
}: SortSelectProps) {
  const t = useTranslations("search");
  // Combine sortBy and sortOrder into a single value for simpler UX
  const combinedValue = `${sortBy}:${sortOrder}`;

  const handleChange = (value: string) => {
    const [field, order] = value.split(":") as [string, "asc" | "desc"];
    onSortByChange(field);
    onSortOrderChange(order);
  };

  // For price-like fields, use different labels
  const getLabelForOption = (opt: SortOption, order: "asc" | "desc") => {
    const field = opt.value.toLowerCase();
    if (field === "price") {
      return order === "asc"
        ? `${opt.label}: ${t("lowToHigh")}`
        : `${opt.label}: ${t("highToLow")}`;
    }
    if (field === "title" || field === "name") {
      return order === "asc" ? `${opt.label}: ${t("aToZ")}` : `${opt.label}: ${t("zToA")}`;
    }
    if (field === "avgrating") {
      return order === "asc"
        ? `${opt.label}: ${t("lowToHigh")}`
        : `${opt.label}: ${t("highToLow")}`;
    }
    if (field === "total") {
      return order === "asc"
        ? `${opt.label}: ${t("lowToHigh")}`
        : `${opt.label}: ${t("highToLow")}`;
    }
    return order === "asc"
      ? `${opt.label}: ${t("oldestFirst")}`
      : `${opt.label}: ${t("newestFirst")}`;
  };

  const [field, order] = combinedValue.split(":") as [string, "asc" | "desc"];
  const currentOption = options.find((o) => o.value === field);
  const currentLabel = currentOption
    ? getLabelForOption(currentOption, order)
    : t("sortBy");

  return (
    <Select value={combinedValue} onValueChange={handleChange}>
      {/* No hard max-width here: `min-w-0` lets the trigger shrink and
          truncate (via the value span below) when its flex row is actually
          tight, but otherwise it sizes to the label so the sort icon isn't
          squeezed against clipped text. Callers in non-wrapping rows can
          still pass an explicit cap via `triggerClassName`. */}
      <SelectTrigger className={cn("gap-1.5 min-w-0", triggerClassName)}>
        <ArrowUpDown className="size-3.5 text-muted-foreground shrink-0" />
        <SelectValue placeholder={t("sortBy")}>
          <span className="truncate">{currentLabel}</span>
        </SelectValue>
      </SelectTrigger>
      {/* `align="start"` lines the menu's left edge up with the trigger's -
          the default "center" would center it under the icon *and* the
          label, landing items noticeably left of where the label text sits.
          Items then get that same offset (border + trigger's pl-2.5 + the
          icon's own size-3.5 + the gap-1.5 next to it = 31px) added to their
          own inset, so the item text lines up with the label text rather
          than the icon above it. */}
      <SelectContent align="start">
        {options.map((opt) => (
          <div key={opt.value}>
            <SelectItem value={`${opt.value}:desc`} className="pl-7.75">
              {getLabelForOption(opt, "desc")}
            </SelectItem>
            <SelectItem value={`${opt.value}:asc`} className="pl-7.75">
              {getLabelForOption(opt, "asc")}
            </SelectItem>
          </div>
        ))}
      </SelectContent>
    </Select>
  );
}