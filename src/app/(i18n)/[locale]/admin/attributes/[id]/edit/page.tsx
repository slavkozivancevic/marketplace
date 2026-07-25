import { Link, getPathname } from "@/i18n/navigation";
import { notFound } from "next/navigation";
import { cacheTag } from "next/cache";
import { getLocale, getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { Button } from "@/components/ui/button";
import { CacheTags } from "@/lib/cache/tags";
import { getAttributeById } from "@/features/attributes/db/attributes";
import { getAttributeLabel } from "@/features/attributes/utils/translations";
import { attributeToFormValues } from "@/features/attributes/utils/form";
import { AttributeForm } from "@/features/attributes/components/AttributeForm";

export default async function EditAttributePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await getTranslations("adminAttributes");
  const tCrumbs = await getTranslations("breadcrumbs");
  const locale = await getLocale();

  const attribute = await fetchAttribute(id);
  if (!attribute) notFound();

  const breadcrumbItems = [
    { name: tCrumbs("admin"), href: getPathname({ href: "/admin", locale }) },
    {
      name: tCrumbs("adminAttributes"),
      href: getPathname({ href: "/admin/attributes", locale }),
    },
    {
      name: tCrumbs("editAttribute"),
      href: getPathname({
        href: { pathname: "/admin/attributes/[id]/edit", params: { id } },
        locale,
      }),
    },
  ];

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="shrink-0 px-6 pt-2 sticky-header-bg">
        <Breadcrumbs items={breadcrumbItems} seo={false} />
        <PageHeader
          title={t("editTitle", { label: getAttributeLabel(attribute, locale) })}
        >
          <Button asChild variant="outline">
            <Link href="/admin/attributes">{t("back")}</Link>
          </Button>
        </PageHeader>
      </div>
      <div className="flex-1 overflow-y-auto min-h-0 px-6 pb-6">
        <AttributeForm
          key={crypto.randomUUID()}
          mode="edit"
          attributeId={id}
          defaultValues={attributeToFormValues(attribute)}
        />
      </div>
    </div>
  );
}

async function fetchAttribute(id: string) {
  "use cache";
  cacheTag(CacheTags.attributes.byId(id));
  return getAttributeById(id);
}
