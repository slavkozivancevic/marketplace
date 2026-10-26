import { getTranslations } from "next-intl/server";
import { SkeletonBreadcrumbs, SkeletonButton, SkeletonPageHeader } from "@/components/ui/skeleton";
import type { PricingScope } from "./PriceRulesScreens";
import { PriceRuleFormSkeleton } from "./PriceRuleFormSkeleton";

/**
 * Route skeleton for the price-rule create and edit pages: the header here,
 * the form body in <PriceRuleFormSkeleton>, which draws the rows of the exact
 * rule being opened when the rules table handed its shape over on the click.
 */
export async function PriceRuleFormLoading({
  scope,
  mode,
}: {
  scope: PricingScope;
  mode: "create" | "edit";
}) {
  const t = await getTranslations("priceRules");

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="shrink-0 px-6 pt-2 sticky-header-bg">
        {/* Root crumbs, product title, "Price rules", this page. */}
        <SkeletonBreadcrumbs
          segments={5}
          widths={
            scope === "admin"
              ? ["w-9", "w-12", "w-24", "w-16", mode === "edit" ? "w-20" : "w-16"]
              : ["w-20", "w-20", "w-24", "w-16", mode === "edit" ? "w-20" : "w-16"]
          }
        />
        {/* The description is the product's name, unknown until it loads. The
            back button links to the rules list, whose href needs the route's
            [id] - so it is the real label on a placeholder, at its real width. */}
        <SkeletonPageHeader
          title={mode === "edit" ? t("editTitle") : t("newTitle")}
          descriptionWidth="w-32"
          actions={<SkeletonButton label={t("backToRules")} />}
        />
      </div>
      <div className="flex-1 overflow-y-auto min-h-0 px-6 pb-6">
        <PriceRuleFormSkeleton mode={mode} />
      </div>
    </div>
  );
}
