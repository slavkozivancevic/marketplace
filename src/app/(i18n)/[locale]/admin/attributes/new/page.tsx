import { Link, getPathname } from "@/i18n/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { Button } from "@/components/ui/button";
import { AttributeForm } from "@/features/attributes/components/AttributeForm";

export default async function NewAttributePage() {
  const t = await getTranslations("adminAttributes");
  const tCrumbs = await getTranslations("breadcrumbs");
  const locale = await getLocale();

  const breadcrumbItems = [
    { name: tCrumbs("admin"), href: getPathname({ href: "/admin", locale }) },
    {
      name: tCrumbs("adminAttributes"),
      href: getPathname({ href: "/admin/attributes", locale }),
    },
    {
      name: tCrumbs("newAttribute"),
      href: getPathname({ href: "/admin/attributes/new", locale }),
    },
  ];

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="shrink-0 px-6 pt-2 sticky-header-bg">
        <Breadcrumbs items={breadcrumbItems} seo={false} />
        <PageHeader title={t("createTitle")} description={t("createDesc")}>
          <Button asChild variant="outline">
            <Link href="/admin/attributes">{t("back")}</Link>
          </Button>
        </PageHeader>
      </div>
      <div className="flex-1 overflow-y-auto min-h-0 px-6 pb-6">
        <AttributeForm mode="create" />
      </div>
    </div>
  );
}
