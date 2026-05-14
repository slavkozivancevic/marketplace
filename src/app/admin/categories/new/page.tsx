import Link from "next/link";
import { cacheTag } from "next/cache";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { CacheTags } from "@/lib/cache/tags";
import { getAllCategoriesFlat } from "@/features/categories/db/categories";
import { CategoryForm } from "@/features/categories/components/CategoryForm";

export default async function NewCategoryPage() {
  const t = await getTranslations("adminCategories");
  const allCategories = await fetchCategories();

  const parentOptions = allCategories.map((c) => ({
    id: c.id,
    name: c.name,
    parentId: c.parentId,
    translations: c.translations,
  }));

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="shrink-0 px-6">
        <PageHeader title={t("createTitle")} description={t("createDesc")}>
          <Button asChild variant="outline">
            <Link href="/admin/categories">{t("back")}</Link>
          </Button>
        </PageHeader>
      </div>
      <div className="flex-1 overflow-y-auto min-h-0 px-6 pb-6">
        <CategoryForm mode="create" parentOptions={parentOptions} />
      </div>
    </div>
  );
}

async function fetchCategories() {
  "use cache";
  cacheTag(CacheTags.categories.all());
  return getAllCategoriesFlat();
}