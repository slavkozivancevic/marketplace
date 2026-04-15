"use client";

import { ArrowUpDown } from "lucide-react";
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
}

export function SortSelect({
  sortBy,
  sortOrder,
  onSortByChange,
  onSortOrderChange,
  options,
}: SortSelectProps) {
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
        ? `${opt.label}: Low to High`
        : `${opt.label}: High to Low`;
    }
    if (field === "title" || field === "name") {
      return order === "asc" ? `${opt.label}: A to Z` : `${opt.label}: Z to A`;
    }
    if (field === "avgrating") {
      return order === "asc"
        ? `${opt.label}: Low to High`
        : `${opt.label}: High to Low`;
    }
    if (field === "total") {
      return order === "asc"
        ? `${opt.label}: Low to High`
        : `${opt.label}: High to Low`;
    }
    return order === "asc"
      ? `${opt.label}: Oldest first`
      : `${opt.label}: Newest first`;
  };

  return (
    <Select value={combinedValue} onValueChange={handleChange}>
      <SelectTrigger className="gap-1.5">
        <ArrowUpDown className="size-3.5 text-muted-foreground" />
        <SelectValue placeholder="Sort by..." />
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