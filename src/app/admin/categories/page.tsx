import Link from "next/link";
import { cacheTag } from "next/cache";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { CacheTags } from "@/lib/cache/tags";
import { getAllCategoriesFlat } from "@/features/categories/db/categories";
import { AdminCategoriesPage } from "@/features/categories/components/AdminCategoriesPage";

export default async function AdminCategoriesRoute() {
  const t = await getTranslations("adminCategories");
  const categories = await fetchCategories();

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="shrink-0 px-6">
        <PageHeader title={t("title")} description={t("pageDesc")}>
          <Button asChild>
            <Link href="/admin/categories/new">{t("addCategory")}</Link>
          </Button>
        </PageHeader>
      </div>
      <div className="flex-1 flex flex-col min-h-0 px-6 pb-6">
        <AdminCategoriesPage categories={categories} />
      </div>
    </div>
  );
}

async function fetchCategories() {
  "use cache";
  cacheTag(CacheTags.categories.all());
  return getAllCategoriesFlat();
}