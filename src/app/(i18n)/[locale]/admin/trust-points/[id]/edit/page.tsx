import { Link, getPathname } from "@/i18n/navigation";
import { notFound } from "next/navigation";
import { cacheTag } from "next/cache";
import { getLocale, getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { Button } from "@/components/ui/button";
import { CacheTags } from "@/lib/cache/tags";
import { getTrustPointById } from "@/features/trustPoints/db/trustPoints";
import { getTrustPointLabel } from "@/features/trustPoints/utils/translations";
import { TrustPointForm } from "@/features/trustPoints/components/TrustPointForm";
import { RemountOnNavigation } from "@/components/forms/RemountOnNavigation";
import { DEFAULT_LOCALE, NON_DEFAULT_LOCALES } from "@/i18n/config";
import { isTrustPointIcon } from "@/features/trustPoints/icons";
import type { UpdateTrustPointInput } from "@/features/trustPoints/schema/trustPoints";

export default async function EditTrustPointPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const t = await getTranslations();
  const tCrumbs = await getTranslations("breadcrumbs");
  const locale = await getLocale();
  const { id } = await params;
  const point = await fetchTrustPoint(id);

  if (!point) notFound();

  const breadcrumbItems = [
    { name: tCrumbs("admin"), href: getPathname({ href: "/admin", locale }) },
    {
      name: tCrumbs("adminTrustPoints"),
      href: getPathname({ href: "/admin/trust-points", locale }),
    },
    {
      name: tCrumbs("editTrustPoint"),
      href: getPathname({
        href: { pathname: "/admin/trust-points/[id]/edit", params: { id } },
        locale,
      }),
    },
  ];

  const en = point.translations.find((tr) => tr.locale === DEFAULT_LOCALE);
  // Every locale gets an entry, with empty strings where no row exists. A
  // missing key would leave that locale's react-hook-form default `undefined`,
  // and typing into the field then clearing it back to "" would compare against
  // `undefined` forever - the changed hint and the unsaved-changes warning
  // would never clear. Same trap the tag and brand edit pages document.
  const translations: NonNullable<UpdateTrustPointInput["translations"]> = {};
  for (const loc of NON_DEFAULT_LOCALES) {
    const row = point.translations.find((tr) => tr.locale === loc);
    translations[loc] = { label: row?.label ?? "", sublabel: row?.sublabel ?? "" };
  }

  // `getTrustPointLabel`, not `find(locale)?.label ?? en?.label` - `??` stops
  // at a present-but-blank label and would title the page with an empty string.
  const displayLabel = getTrustPointLabel(point, locale);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="shrink-0 px-6 pt-2 sticky-header-bg">
        <Breadcrumbs items={breadcrumbItems} seo={false} />
        <PageHeader
          title={t("admin.editTrustPoint", { name: displayLabel })}
          description={t("admin.editTrustPointDesc")}
        >
          <Button asChild variant="outline">
            <Link href="/admin/trust-points">{t("admin.backToTrustPoints")}</Link>
          </Button>
        </PageHeader>
      </div>
      <div className="flex-1 overflow-y-auto min-h-0 px-6 pb-6">
        {/* Remounts only when the user navigates away and back, so a
            half-edited form never reopens as if it were the saved record. NOT a
            fresh key per render: that tears the form down mid-save, every time
            a Server Action revalidates this page. */}
        <RemountOnNavigation>
          <TrustPointForm
            mode="edit"
            trustPointId={point.id}
            defaultValues={{
              label: en?.label ?? "",
              sublabel: en?.sublabel ?? "",
              // A row whose icon key has since been retired from the allow-list
              // would fail the enum on save; fall back to a valid one so the
              // form opens on something it can actually submit.
              icon: isTrustPointIcon(point.icon) ? point.icon : "shield",
              order: point.order,
              isActive: point.isActive,
              translations,
            }}
          />
        </RemountOnNavigation>
      </div>
    </div>
  );
}

async function fetchTrustPoint(id: string) {
  "use cache";
  cacheTag(CacheTags.trustPoints.byId(id));
  return getTrustPointById(id);
}
