"use client";

import { useLocale, useTranslations } from "next-intl";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getBrandName } from "../utils/translations";

/**
 * Brand option shape used by the select. Carries the full per-locale
 * translations payload so the rendered label resolves to the active UI
 * language without callers having to compute it.
 */
export type BrandOption = {
  id: string;
  translations: {
    locale: string;
    name: string;
    slug: string;
    description: string | null;
  }[];
};

interface BrandSelectProps {
  brands: BrandOption[];
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  disabled?: boolean;
}

export function BrandSelect({ brands, value, onChange, disabled }: BrandSelectProps) {
  const t = useTranslations("brands");
  const locale = useLocale();
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
          {selectedBrand ? getBrandName(selectedBrand, locale) : t("noBrand")}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none" className="cursor-pointer">{t("noBrand")}</SelectItem>
        {brands.map((brand) => (
          <SelectItem key={brand.id} value={brand.id} className="cursor-pointer">
            {getBrandName(brand, locale)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
