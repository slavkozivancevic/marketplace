import { Link, getPathname } from "@/i18n/navigation";
import { cacheTag } from "next/cache";
import { getLocale, getTranslations } from "next-intl/server";
import { LayoutList } from "lucide-react";
import { connection } from "next/server";

import { resolveRequestContext } from "@/lib/auth/resolveRequestContext";
import { requirePermission } from "@/lib/auth/permissions";
import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { AdminProductsPage } from "@/features/products/components/AdminProductsPage";
import { Button } from "@/components/ui/button";
import { CacheTags } from "@/lib/cache/tags";
import { getAllBrands } from "@/features/brands/db/brands";

export default async function AdminProductsRoute() {
  await connection();
  const t = await getTranslations();
  const tCrumbs = await getTranslations("breadcrumbs");
  const locale = await getLocale();
  const breadcrumbItems = [
    { name: tCrumbs("admin"), href: getPathname({ href: "/admin", locale }) },
    { name: tCrumbs("adminProducts"), href: getPathname({ href: "/admin/products", locale }) },
  ];
  const ctx = await resolveRequestContext();
  requirePermission(ctx, "product:read");

  // The list is fetched client-side (AdminProductsList via React Query with
  // `refetchOnMount: "always"`), so a blocking SSR prefetch here only froze the
  // server render behind a loading.tsx while the client re-fetched anyway. We
  // drop it: the server renders instantly and the list's own skeleton is the
  // single loading state (no double skeleton).
  const brands = await fetchBrands();

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="shrink-0 px-6 pt-2 sticky-header-bg">
        <Breadcrumbs items={breadcrumbItems} seo={false} />
        <PageHeader
          title={t("admin.products")}
          description={t("admin.productsBrowse")}
        >
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
        <AdminProductsPage brands={brands} />
      </div>
    </div>
  );
}

async function fetchBrands() {
  "use cache";
  cacheTag(CacheTags.brands.all());
  return getAllBrands();
}
