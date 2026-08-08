import { Link, getPathname } from "@/i18n/navigation";
import { cacheTag } from "next/cache";
import { getLocale, getTranslations } from "next-intl/server";

import { resolveRequestContext } from "@/lib/auth/resolveRequestContext";
import { requirePermission } from "@/lib/auth/permissions";
import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { Button } from "@/components/ui/button";
import { BulkProductsManager } from "@/features/products/components/BulkProductsManager";
import { getAllBrands, getBrandName } from "@/features/brands/db/brands";
import {
  getAllCategoriesFlat,
  getCategoryName,
} from "@/features/categories/db/categories";
import { getAllTags, getTagName } from "@/features/tags/db/tags";
import { CacheTags } from "@/lib/cache/tags";

type CategoryRow = {
  id: string;
  parentId: string | null;
  translations: {
    locale: string;
    name: string;
    slug: string;
    description: string | null;
  }[];
};

/**
 * Build "Parent > Child > Grandchild" display labels from the flat
 * category list. Names are resolved against the active locale so the bulk
 * panel matches the rest of the admin UI (e.g. category page).
 */
function buildCategoryPaths(
  flat: CategoryRow[],
  locale: string,
): { id: string; name: string; pathName: string }[] {
  const byId = new Map(flat.map((c) => [c.id, c]));

  function pathName(c: CategoryRow): string {
    const parts: string[] = [getCategoryName(c, locale)];
    let cur = c.parentId ? byId.get(c.parentId) : undefined;
    while (cur) {
      parts.unshift(getCategoryName(cur, locale));
      cur = cur.parentId ? byId.get(cur.parentId) : undefined;
    }
    return parts.join(" > ");
  }

  return flat
    .map((c) => ({ id: c.id, name: getCategoryName(c, locale), pathName: pathName(c) }))
    .sort((a, b) => a.pathName.localeCompare(b.pathName, locale));
}

export default async function BulkProductsPage() {
  const t = await getTranslations();
  const tCrumbs = await getTranslations("breadcrumbs");
  const locale = await getLocale();
  const breadcrumbItems = [
    { name: tCrumbs("admin"), href: getPathname({ href: "/admin", locale }) },
    { name: tCrumbs("adminProducts"), href: getPathname({ href: "/admin/products", locale }) },
    { name: tCrumbs("bulkOperations"), href: getPathname({ href: "/admin/products/bulk", locale }) },
  ];
  const ctx = await resolveRequestContext();
  requirePermission(ctx, "product:read");

  const [brands, categoryRows, tags] = await Promise.all([
    fetchBrands(),
    fetchCategories(),
    fetchTags(),
  ]);

  const categories = buildCategoryPaths(categoryRows, locale);
  const localizedBrands = brands
    .map((b) => ({
      id: b.id,
      name: getBrandName(b, locale),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, locale));
  const localizedTags = tags
    .map((tg) => ({
      id: tg.id,
      name: getTagName(tg, locale),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, locale));

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="shrink-0 px-6 pt-2 sticky-header-bg">
        <Breadcrumbs items={breadcrumbItems} seo={false} />
        <PageHeader
          title={t("admin.bulkTitle")}
          description={t("admin.bulkDesc")}
        >
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/products">{t("admin.backToProducts")}</Link>
          </Button>
        </PageHeader>
      </div>

      <div className="flex-1 flex flex-col min-h-0 px-6 pb-6">
        <BulkProductsManager brands={localizedBrands} categories={categories} tags={localizedTags} />
      </div>
    </div>
  );
}

async function fetchBrands() {
  "use cache";
  cacheTag(CacheTags.brands.all());
  return getAllBrands();
}

async function fetchCategories(): Promise<CategoryRow[]> {
  "use cache";
  cacheTag(CacheTags.categories.all());
  const cats = await getAllCategoriesFlat();
  return cats.map((c) => ({
    id: c.id,
    translations: c.translations,
    parentId: c.parentId,
  }));
}

async function fetchTags() {
  "use cache";
  cacheTag(CacheTags.tags.all());
  return getAllTags();
}
