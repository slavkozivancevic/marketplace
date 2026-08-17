import { Link, getPathname } from "@/i18n/navigation";
import { notFound } from "next/navigation";
import { cacheTag } from "next/cache";
import { getLocale, getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { Button } from "@/components/ui/button";
import { CacheTags } from "@/lib/cache/tags";
import {
  getCategoryById,
  getAllCategoriesFlat,
  getCategoryAttributeMap,
} from "@/features/categories/db/categories";
import { getAttributeLibrary } from "@/features/attributes/db/attributes";
import { CategoryForm } from "@/features/categories/components/CategoryForm";
import { DEFAULT_LOCALE, NON_DEFAULT_LOCALES } from "@/i18n/config";
import {
  getCategoryName,
  type CategoryTranslations,
} from "@/features/categories/utils/translations";

export default async function EditCategoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await getTranslations("adminCategories");
  const tCrumbs = await getTranslations("breadcrumbs");
  const locale = await getLocale();

  const [category, allCategories, attributeLibrary, categoryAttributeMap] =
    await Promise.all([
      fetchCategory(id),
      fetchCategories(),
      fetchAttributeLibrary(),
      fetchCategoryAttributeMap(),
    ]);

  if (!category) notFound();

  const breadcrumbItems = [
    { name: tCrumbs("admin"), href: getPathname({ href: "/admin", locale }) },
    { name: tCrumbs("adminCategories"), href: getPathname({ href: "/admin/categories", locale }) },
    {
      name: tCrumbs("editCategory"),
      href: getPathname({ href: { pathname: "/admin/categories/[id]/edit", params: { id } }, locale }),
    },
  ];

  // Exclude the category itself (and its descendants ideally) from parent options
  const parentOptions = allCategories
    .filter((c) => c.id !== id)
    .map((c) => ({ id: c.id, parentId: c.parentId, translations: c.translations }));

  // Pull the default-locale row for the canonical form fields and build a
  // non-default translations map for the rest.
  const en = category.translations.find((tr) => tr.locale === DEFAULT_LOCALE);
  const nonDefault: CategoryTranslations = {};
  for (const loc of NON_DEFAULT_LOCALES) {
    const row = category.translations.find((tr) => tr.locale === loc);
    nonDefault[loc] = {
      name: row?.name ?? "",
      // The stored slug MUST round-trip through the form WHEN a name is
      // present - omitting it unconditionally made every save regenerate
      // the slug from the (possibly unchanged) name, which collided with
      // the source category after a duplicate ("already exists" on any
      // edit of the copy). But when name is blank, any stored slug is only
      // a derived implementation detail (see buildCategoryTranslationRows)
      // kept for URL validity, not something the admin entered - show it as
      // blank too rather than as if it were.
      slug: row?.name ? (row?.slug ?? "") : "",
      description: row?.description ?? "",
    };
  }

  // `getCategoryName` (not a raw `find(locale)?.name ?? en?.name`) - this
  // locale can HAVE a translation row whose name was left blank (kept alive
  // by its slug/description, see buildCategoryTranslationRows), and `??`
  // would then hand back that empty string instead of falling back to English.
  const displayName = getCategoryName(category, locale);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="shrink-0 px-6 pt-2 sticky-header-bg">
        <Breadcrumbs items={breadcrumbItems} seo={false} />
        <PageHeader title={t("editTitle", { name: displayName })}>
          <Button asChild variant="outline">
            <Link href="/admin/categories">{t("back")}</Link>
          </Button>
        </PageHeader>
      </div>
      <div className="flex-1 overflow-y-auto min-h-0 px-6 pb-6">
        {/* Fresh key forces remount on each page render so unsaved edits
            don't persist across navigations (Next.js can preserve the
            form's in-memory state otherwise). */}
        <CategoryForm
          key={crypto.randomUUID()}
          mode="edit"
          categoryId={id}
          parentOptions={parentOptions}
          attributeLibrary={attributeLibrary}
          categoryAttributeMap={categoryAttributeMap}
          defaultValues={{
            name: en?.name ?? "",
            slug: en?.slug ?? "",
            parentId: category.parentId,
            imageUrl: category.imageUrl ?? "",
            description: en?.description ?? "",
            order: category.order,
            isActive: category.isActive,
            isFeatured: category.isFeatured,
            translations: nonDefault,
            attributes: category.attributes.map((a) => ({
              attributeId: a.attributeId,
              order: a.order,
              isFilterable: a.isFilterable,
            })),
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

async function fetchAttributeLibrary() {
  "use cache";
  cacheTag(CacheTags.attributes.all());
  return getAttributeLibrary();
}

async function fetchCategoryAttributeMap() {
  "use cache";
  cacheTag(CacheTags.categories.all());
  return getCategoryAttributeMap();
}