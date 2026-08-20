import { getLocale, getTranslations } from "next-intl/server";
import { getPathname } from "@/i18n/navigation";
import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { Skeleton } from "@/components/ui/skeleton";
import { FilterListPageSkeleton } from "@/components/search/FilterListPageSkeleton";
import { OrgPayoutTableSkeleton } from "@/features/payments/components/OrgPayoutTableSkeleton";

/**
 * This is the slowest route in the dashboard: `syncConnectStatus()` is a live
 * Stripe round-trip that runs before anything renders, so without a fallback
 * the previous page stays on screen for the whole call.
 *
 * Two things this placeholder cannot know, both deliberate:
 *  - Whether the org is verified. Unverified orgs get a short Alert instead of
 *    this whole layout; they are the rare case and they reach the page once.
 *  - Whether <ConnectPayouts> renders collapsed. It starts OPEN while onboarding
 *    is incomplete and collapsed once payouts are fully enabled, so the card is
 *    modelled at its collapsed height - the steady state for a seller who
 *    actually visits this page repeatedly.
 *
 * Filter groups match OrgPayoutsPage: status (3) and refund state (3).
 */
export default async function OrgPayoutsLoading() {
  const t = await getTranslations("payouts");
  const tCrumbs = await getTranslations("breadcrumbs");
  const locale = await getLocale();
  const breadcrumbItems = [
    { name: tCrumbs("dashboard"), href: getPathname({ href: "/dashboard", locale }) },
    { name: t("pageTitle"), href: getPathname({ href: "/dashboard/organization/payouts", locale }) },
  ];

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="shrink-0 px-6 pt-2 sticky-header-bg">
        <Breadcrumbs items={breadcrumbItems} seo={false} />
        <PageHeader title={t("pageTitle")} description={t("pageDescription")} />
      </div>

      <div className="flex-1 flex flex-col min-h-0 px-6 pb-6 gap-5">
        {/* <ConnectPayouts>, collapsed: a `gap-0 py-4` Card whose header row is
            28px tall (the h-7 collapse toggle, taller than the 22px title and
            the h-5 status badge). */}
        <div className="shrink-0">
          <div className="flex flex-col gap-0 overflow-hidden rounded-xl bg-card py-4 ring-1 ring-foreground/10">
            <div className="flex flex-row items-center justify-between gap-2 px-4">
              <div className="flex h-7 items-center gap-2 min-w-0">
                <Skeleton className="h-4 w-4 rounded shrink-0" />
                <Skeleton className="h-4 w-40" />
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Skeleton className="h-5 w-24 rounded-4xl" />
                <Skeleton className="h-7 w-7 -mr-1.5 rounded-lg" />
              </div>
            </div>
          </div>
        </div>

        <FilterListPageSkeleton groups={[3, 3]}>
          <OrgPayoutTableSkeleton />
        </FilterListPageSkeleton>
      </div>
    </div>
  );
}
