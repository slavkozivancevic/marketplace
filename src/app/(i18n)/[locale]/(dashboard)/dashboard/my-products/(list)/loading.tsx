import { getLocale, getTranslations } from "next-intl/server";
import { getPathname } from "@/i18n/navigation";
import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { FilterListPageSkeleton } from "@/components/search/FilterListPageSkeleton";
import { ProductTableSkeleton } from "@/features/products/components/ProductTableSkeleton";

/**
 * The header's "Create product" button and the unverified-org banner are both
 * conditional on membership role / org verification, which this fallback can't
 * know - so it renders neither rather than flashing a control the user may not
 * be allowed to have. Nothing shifts because of it: on `md` and up the header
 * row is taller than a button anyway (title + description), and the actions
 * column is `md:shrink-0` on the right.
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
        <PageHeader title={t("myProducts.title")} description={t("myProducts.manage")} />
      </div>
      <div className="flex-1 flex flex-col min-h-0 px-6 pb-6">
        <FilterListPageSkeleton groups={[3, "range", 8, 3]}>
          <ProductTableSkeleton showActions />
        </FilterListPageSkeleton>
      </div>
    </div>
  );
}
