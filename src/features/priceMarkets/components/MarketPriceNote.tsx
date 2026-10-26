"use client";

import { useLocale, useTranslations } from "next-intl";
import { MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { countryName } from "@/lib/i18n/countries";
import { useViewerMarket } from "@/providers/MarketProvider";
import type { AppliedMarketRule } from "../utils/viewerPrices";

/**
 * Says whose price this is, whenever a market rule changed it. Differential
 * pricing is legal here only as a price list the buyer can see and switch
 * (dynamic-pricing spec, "Legal" and acceptance 15), so a market-adjusted
 * price never appears without the country it was priced for. Renders nothing
 * for the default price.
 */
export function MarketPriceNote({ rule, className }: { rule: AppliedMarketRule | undefined; className?: string }) {
  const t = useTranslations("priceMarkets");
  const locale = useLocale();
  const { country } = useViewerMarket();
  if (!rule) return null;
  return (
    <p className={cn("flex items-center gap-1 text-xs text-muted-foreground", className)}>
      <MapPin className="h-3 w-3 shrink-0" aria-hidden />
      <span className="truncate">
        {country ? t("priceFor", { country: countryName(country, locale) }) : t("priceForRegion")}
      </span>
    </p>
  );
}
