"use client";

import { useParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import {
  Skeleton,
  SkeletonAdminForm,
  SkeletonCopy,
  SkeletonFormDescription,
  SkeletonLocaleSections,
} from "@/components/ui/skeleton";
import { sortedCountries } from "@/lib/i18n/countries";
import { readRouteShape } from "@/lib/navigation/routeShape";

/** What the markets list hands an edit's skeleton (see AdminPriceMarketsPage). */
export type PriceMarketFormShape = { isDefault: boolean; countries: string[] };

export function priceMarketShapeKey(marketId: string): string {
  return `price-market:${marketId}`;
}

/**
 * Placeholder for <PriceMarketForm>, shared by the create and edit loading
 * states. Four locale boxes with one name field each, then the countries box:
 * its caption, then either the default market's note or the field - label, the
 * picker's `h-8` trigger, one chip per country (an edit) and the description.
 *
 * The chips wrap by their names, so an edit draws the market's own countries,
 * in the picker's own order, when the list handed them over. Known copy is
 * the real text.
 */
export function PriceMarketFormSkeleton({ mode = "create" }: { mode?: "create" | "edit" } = {}) {
  const t = useTranslations("priceMarkets");
  const locale = useLocale();
  const params = useParams<{ id?: string }>();
  const shape =
    mode === "edit" && params.id ? readRouteShape<PriceMarketFormShape>(priceMarketShapeKey(params.id)) : null;
  const chosen = new Set(shape?.countries ?? []);
  // Chips in localized-name order, as <CountryMultiSelect> lays them out.
  const chips = shape ? sortedCountries(locale).filter((c) => chosen.has(c.code)) : [];

  return (
    <SkeletonAdminForm mode={mode} submitLabel={t("create")}>
      <SkeletonLocaleSections radius="lg" fields={["input"]} labelWidths={["w-12"]} mode={mode} />

      <div className="rounded-lg border border-border/60 p-4 space-y-4">
        <p className="text-xs font-semibold uppercase tracking-widest">
          <SkeletonCopy>{t("countries")}</SkeletonCopy>
        </p>
        {shape?.isDefault ? (
          <p className="text-sm">
            <SkeletonCopy>{t("defaultCountriesNote")}</SkeletonCopy>
          </p>
        ) : (
          <div className="space-y-2">
            <div className="text-sm leading-none font-medium">
              <SkeletonCopy>{t("countries")}</SkeletonCopy>
            </div>
            {/* <CountryMultiSelect>: its trigger, then the chips, in its own `space-y-2`. */}
            <div className="space-y-2">
              <Skeleton className="h-8 w-full rounded-lg" />
              {chips.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {chips.map((c) => (
                    // The chip: a secondary <Badge> with the name and a 12px remove icon.
                    <Badge key={c.code} variant="secondary" className="gap-1 animate-pulse bg-muted text-transparent">
                      {c.name}
                      <span className="size-3" />
                    </Badge>
                  ))}
                </div>
              )}
            </div>
            <SkeletonFormDescription>{t("countriesDesc")}</SkeletonFormDescription>
          </div>
        )}
      </div>
    </SkeletonAdminForm>
  );
}
