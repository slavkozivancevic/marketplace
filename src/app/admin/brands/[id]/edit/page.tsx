import Link from "next/link";
import { notFound } from "next/navigation";
import { cacheTag } from "next/cache";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { CacheTags } from "@/lib/cache/tags";
import { getBrandById } from "@/features/brands/db/brands";
import type { BrandTranslations } from "@/features/brands/utils/translations";
import { BrandForm } from "@/features/brands/components/BrandForm";

export default async function EditBrandPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const t = await getTranslations();
  const { id } = await params;
  const brand = await fetchBrand(id);

  if (!brand) notFound();

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="shrink-0 px-6">
        <PageHeader
          title={t("admin.editBrand", { name: brand.name })}
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
            name: brand.name,
            slug: brand.slug,
            logoUrl: brand.logoUrl ?? "",
            description: brand.description ?? "",
            translations: (brand.translations as BrandTranslations | null) ?? null,
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