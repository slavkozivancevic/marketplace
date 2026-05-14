import Link from "next/link";
import { notFound } from "next/navigation";
import { cacheTag } from "next/cache";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { CacheTags } from "@/lib/cache/tags";
import {
  getCategoryById,
  getAllCategoriesFlat,
} from "@/features/categories/db/categories";
import { CategoryForm } from "@/features/categories/components/CategoryForm";

export default async function EditCategoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await getTranslations("adminCategories");

  const [category, allCategories] = await Promise.all([
    fetchCategory(id),
    fetchCategories(),
  ]);

  if (!category) notFound();

  // Exclude the category itself (and its descendants ideally) from parent options
  const parentOptions = allCategories
    .filter((c) => c.id !== id)
    .map((c) => ({ id: c.id, name: c.name, parentId: c.parentId, translations: c.translations }));

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="shrink-0 px-6">
        <PageHeader title={t("editTitle")} description={category.name}>
          <Button asChild variant="outline">
            <Link href="/admin/categories">{t("back")}</Link>
          </Button>
        </PageHeader>
      </div>
      <div className="flex-1 overflow-y-auto min-h-0 px-6 pb-6">
        <CategoryForm
          mode="edit"
          categoryId={id}
          parentOptions={parentOptions}
          defaultValues={{
            name: category.name,
            slug: category.slug,
            parentId: category.parentId,
            imageUrl: category.imageUrl ?? "",
            description: category.description ?? "",
            order: category.order,
            isActive: category.isActive,
            isFeatured: category.isFeatured,
            translations: category.translations ?? { sr: { name: "", description: "" } },
          }}
        />
      </div>
    </div>
  );
}

async function fetchCategory(id: string) {
  "use cache";
  cacheTag(CacheTags.categories.byId(id));
  return getCategoryById(id);
}

async function fetchCategories() {
  "use cache";
  cacheTag(CacheTags.categories.all());
  return getAllCategoriesFlat();
}