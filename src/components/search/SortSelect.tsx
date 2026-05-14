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
      <SelectTrigger className={cn("gap-1.5 max-w-52", triggerClassName)}>
        <ArrowUpDown className="size-3.5 text-muted-foreground shrink-0" />
        <SelectValue placeholder={t("sortBy")}>
          <span className="truncate">{currentLabel}</span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {options.map((opt) => (
          <div key={opt.value}>
            <SelectItem value={`${opt.value}:desc`}>
              {getLabelForOption(opt, "desc")}
            </SelectItem>
            <SelectItem value={`${opt.value}:asc`}>
              {getLabelForOption(opt, "asc")}
            </SelectItem>
          </div>
        ))}
      </SelectContent>
    </Select>
  );
}