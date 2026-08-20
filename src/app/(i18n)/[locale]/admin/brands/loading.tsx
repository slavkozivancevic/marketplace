import { Link, getPathname } from "@/i18n/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { Button } from "@/components/ui/button";
import { BrandTableSkeleton } from "@/features/brands/components/BrandTableSkeleton";

/**
 * The page shell (breadcrumbs, header, action button) is rendered with the REAL
 * components and REAL translations - all of it is static per route, so greying
 * it out would only add a flash and a chance to drift. Only the brand rows,
 * which genuinely depend on the query, get a placeholder.
 *
 * Keep the outer boxes byte-identical to `page.tsx` or the header shifts when
 * the page swaps in.
 */
export default async function AdminBrandsLoading() {
  const t = await getTranslations();
  const tCrumbs = await getTranslations("breadcrumbs");
  const locale = await getLocale();
  const breadcrumbItems = [
    { name: tCrumbs("admin"), href: getPathname({ href: "/admin", locale }) },
    { name: tCrumbs("adminBrands"), href: getPathname({ href: "/admin/brands", locale }) },
  ];

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="shrink-0 px-6 pt-2 sticky-header-bg">
        <Breadcrumbs items={breadcrumbItems} seo={false} />
        <PageHeader title={t("admin.brands")} description={t("admin.brandsManage")}>
          <Button asChild>
            <Link href="/admin/brands/new">{t("admin.addBrand")}</Link>
          </Button>
        </PageHeader>
      </div>
      <div className="flex-1 flex flex-col min-h-0 px-6 pb-6">
        <BrandTableSkeleton />
      </div>
    </div>
  );
}
