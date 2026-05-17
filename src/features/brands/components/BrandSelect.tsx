"use client";

import { useTranslations } from "next-intl";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type BrandOption = {
  id: string;
  name: string;
};

interface BrandSelectProps {
  brands: BrandOption[];
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  disabled?: boolean;
}

export function BrandSelect({ brands, value, onChange, disabled }: BrandSelectProps) {
  const t = useTranslations("brands");
  const selectedBrand = value ? brands.find((b) => b.id === value) : undefined;
  return (
    <Select
      value={value ?? "none"}
      onValueChange={(v) => onChange(v === "none" ? undefined : v)}
      disabled={disabled}
    >
      <SelectTrigger className="cursor-pointer">
        {/* Explicit children so the label shows pre-hydration (the SelectContent
            is portaled and not available for Radix's value→item lookup yet). */}
        <SelectValue placeholder={t("noBrand")}>
          {selectedBrand?.name ?? t("noBrand")}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none" className="cursor-pointer">{t("noBrand")}</SelectItem>
        {brands.map((brand) => (
          <SelectItem key={brand.id} value={brand.id} className="cursor-pointer">
            {brand.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}