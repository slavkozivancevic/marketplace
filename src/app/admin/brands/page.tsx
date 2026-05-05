import Link from "next/link";
import { cacheTag } from "next/cache";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { CacheTags } from "@/lib/cache/tags";
import { getAllBrands } from "@/features/brands/db/brands";
import { AdminBrandsPage } from "@/features/brands/components/AdminBrandsPage";

export default async function AdminBrandsRoute() {
  const t = await getTranslations();
  const brands = await fetchBrands();

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="shrink-0 px-6">
        <PageHeader
          title={t("admin.brands")}
          description={t("admin.brandsManage")}
        >
          <Button asChild>
            <Link href="/admin/brands/new">{t("admin.addBrand")}</Link>
          </Button>
        </PageHeader>
      </div>
      <div className="flex-1 flex flex-col min-h-0 px-6 pb-6">
        <AdminBrandsPage brands={brands} />
      </div>
    </div>
  );
}

async function fetchBrands() {
  "use cache";
  cacheTag(CacheTags.brands.all());
  return getAllBrands();
}