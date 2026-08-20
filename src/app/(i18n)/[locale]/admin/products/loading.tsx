import { Link, getPathname } from "@/i18n/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { LayoutList } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { Button } from "@/components/ui/button";
import { FilterListPageSkeleton } from "@/components/search/FilterListPageSkeleton";
import { ProductTableSkeleton } from "@/features/products/components/ProductTableSkeleton";

/**
 * The list itself is fetched client-side and has its own pending skeleton, so
 * this fallback exists for the gap BEFORE that: without it, clicking through to
 * this route leaves the previous page on screen for the whole server
 * round-trip (`await connection()` makes the route fully dynamic, and the
 * brands + org-members queries run before anything renders).
 *
 * It deliberately renders the SAME table skeleton the client list falls back
 * to, so the handoff is skeleton -> skeleton -> data with no second flash.
 *
 * Filter groups match AdminProductsPage: status (3 fixed options), price
 * (range), brand (capped at FILTER_OPTIONS_VISIBLE_LIMIT), created-by.
 */
export default async function AdminProductsLoading() {
  const t = await getTranslations();
  const tCrumbs = await getTranslations("breadcrumbs");
  const locale = await getLocale();
  const breadcrumbItems = [
    { name: tCrumbs("admin"), href: getPathname({ href: "/admin", locale }) },
    { name: tCrumbs("adminProducts"), href: getPathname({ href: "/admin/products", locale }) },
  ];

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="shrink-0 px-6 pt-2 sticky-header-bg">
        <Breadcrumbs items={breadcrumbItems} seo={false} />
        <PageHeader title={t("admin.products")} description={t("admin.productsBrowse")}>
          <Button asChild variant="outline">
            <Link href="/admin/products/bulk">
              <LayoutList className="h-4 w-4 mr-1.5" />
              {t("admin.bulkOps")}
            </Link>
          </Button>
          <Button asChild>
            <Link href="/admin/products/new">{t("admin.addProduct")}</Link>
          </Button>
        </PageHeader>
      </div>
      <div className="flex-1 flex flex-col min-h-0 px-6 pb-6">
        <FilterListPageSkeleton groups={[3, "range", 8, 3]}>
          <ProductTableSkeleton showActions showCreatedBy />
        </FilterListPageSkeleton>
      </div>
    </div>
  );
}
