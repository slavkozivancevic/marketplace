import { getLocale, getTranslations } from "next-intl/server";
import { getPathname } from "@/i18n/navigation";
import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { SkeletonButton } from "@/components/ui/skeleton";
import { FilterListPageSkeleton } from "@/components/search/FilterListPageSkeleton";
import { ProductTableSkeleton } from "@/features/products/components/ProductTableSkeleton";

/**
 * The header's "Create product" button only renders for an OWNER/ADMIN of a
 * verified org, which this fallback can't know - but that is who opens this
 * page (the demo seller is one), so it is placeheld; without it the button
 * popped into the corner when the page loaded. The unverified-org banner is
 * the rare case and stays out.
 *
 * `showActions` on the table is likewise role-dependent; the row height is
 * driven by the 48px thumbnail either way, so the actions column only changes
 * the table's horizontal extent inside its own scroll container.
 */
export default async function MyProductsLoading() {
  const t = await getTranslations();
  const tCrumbs = await getTranslations("breadcrumbs");
  const locale = await getLocale();
  const breadcrumbItems = [
    { name: tCrumbs("dashboard"), href: getPathname({ href: "/dashboard", locale }) },
    { name: tCrumbs("myProducts"), href: getPathname({ href: "/dashboard/my-products", locale }) },
  ];

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="shrink-0 px-6 pt-2 sticky-header-bg">
        <Breadcrumbs items={breadcrumbItems} seo={false} />
        <PageHeader title={t("myProducts.title")} description={t("myProducts.manage")}>
          <SkeletonButton label={t("myProducts.create")} />
        </PageHeader>
      </div>
      <div className="flex-1 flex flex-col min-h-0 px-6 pb-6">
        <FilterListPageSkeleton groups={[3, "range", 8, 3]} sortLabel={`${t("myProducts.dateAdded")}: ${t("search.newestFirst")}`}>
          <ProductTableSkeleton showActions />
        </FilterListPageSkeleton>
      </div>
    </div>
  );
}
