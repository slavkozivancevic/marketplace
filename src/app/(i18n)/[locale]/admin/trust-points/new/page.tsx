import { Link, getPathname } from "@/i18n/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { Button } from "@/components/ui/button";
import { TrustPointForm } from "@/features/trustPoints/components/TrustPointForm";

export default async function NewTrustPointPage() {
  const t = await getTranslations();
  const tCrumbs = await getTranslations("breadcrumbs");
  const locale = await getLocale();
  const breadcrumbItems = [
    { name: tCrumbs("admin"), href: getPathname({ href: "/admin", locale }) },
    {
      name: tCrumbs("adminTrustPoints"),
      href: getPathname({ href: "/admin/trust-points", locale }),
    },
    {
      name: tCrumbs("newTrustPoint"),
      href: getPathname({ href: "/admin/trust-points/new", locale }),
    },
  ];

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="shrink-0 px-6 pt-2 sticky-header-bg">
        <Breadcrumbs items={breadcrumbItems} seo={false} />
        <PageHeader
          title={t("admin.createTrustPoint")}
          description={t("admin.createTrustPointDesc")}
        >
          <Button asChild variant="outline">
            <Link href="/admin/trust-points">{t("admin.backToTrustPoints")}</Link>
          </Button>
        </PageHeader>
      </div>
      <div className="flex-1 overflow-y-auto min-h-0 px-6 pb-6">
        <TrustPointForm mode="create" />
      </div>
    </div>
  );
}
