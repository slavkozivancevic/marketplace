import { Link, getPathname } from "@/i18n/navigation";
import { notFound } from "next/navigation";
import { cacheTag } from "next/cache";
import { getLocale, getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { Button } from "@/components/ui/button";
import { CacheTags } from "@/lib/cache/tags";
import { getBrandById } from "@/features/brands/db/brands";
import type { BrandTranslations } from "@/features/brands/utils/translations";
import { BrandForm } from "@/features/brands/components/BrandForm";
import { DEFAULT_LOCALE, NON_DEFAULT_LOCALES } from "@/i18n/config";

export default async function EditBrandPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const t = await getTranslations();
  const tCrumbs = await getTranslations("breadcrumbs");
  const locale = await getLocale();
  const { id } = await params;
  const brand = await fetchBrand(id);

  if (!brand) notFound();

  const breadcrumbItems = [
    { name: tCrumbs("admin"), href: getPathname({ href: "/admin", locale }) },
    { name: tCrumbs("adminBrands"), href: getPathname({ href: "/admin/brands", locale }) },
    {
      name: tCrumbs("editBrand"),
      href: getPathname({ href: { pathname: "/admin/brands/[id]/edit", params: { id } }, locale }),
    },
  ];

  // Form input is keyed by canonical English fields + a non-default
  // translations map. Extract each locale's row from the relation.
  const en = brand.translations.find((tr) => tr.locale === DEFAULT_LOCALE);
  const nonDefault: BrandTranslations = {};
  for (const loc of NON_DEFAULT_LOCALES) {
    const row = brand.translations.find((tr) => tr.locale === loc);
    if (row) {
      nonDefault[loc] = {
        name: row.name,
        description: row.description ?? undefined,
      };
    }
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="shrink-0 px-6 pt-2">
        <Breadcrumbs items={breadcrumbItems} seo={false} />
        <PageHeader
          title={t("admin.editBrand", { name: en?.name ?? "" })}
          description={t("admin.editBrandDesc")}
        >
          <Button asChild variant="outline">
            <Link href="/admin/brands">{t("admin.backToBrands")}</Link>
          </Button>
        </PageHeader>
      </div>
      <div className="flex-1 overflow-y-auto min-h-0 px-6 pb-6">
        {/* Fresh key forces remount on each page render so unsaved edits
            don't persist across navigations (Next.js can preserve the
            form's in-memory state otherwise). */}
        <BrandForm
          key={crypto.randomUUID()}
          mode="edit"
          brandId={brand.id}
          defaultValues={{
            name: en?.name ?? "",
            slug: en?.slug ?? "",
            logoUrl: brand.logoUrl ?? "",
            description: en?.description ?? "",
            translations: nonDefault,
          }}
        />
      </div>
    </div>
  );
}

async function fetchBrand(id: string) {
  "use cache";
  cacheTag(CacheTags.brands.byId(id));
  return getBrandById(id);
}