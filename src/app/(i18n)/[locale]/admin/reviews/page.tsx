import { getLocale, getTranslations } from "next-intl/server";
import { connection } from "next/server";
import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { getPathname } from "@/i18n/navigation";
import { getReviewModerationCounts } from "@/features/reviews/db/adminQueries";
import { ReviewsView } from "@/features/reviews/components/ReviewsView";

export default async function AdminReviewsRoute() {
  await connection();
  const t = await getTranslations("admin.reviews");
  const tCrumbs = await getTranslations("breadcrumbs");
  const locale = await getLocale();
  const counts = await getReviewModerationCounts();

  const breadcrumbItems = [
    { name: tCrumbs("admin"), href: getPathname({ href: "/admin", locale }) },
    { name: tCrumbs("reviews"), href: getPathname({ href: "/admin/reviews", locale }) },
  ];

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="shrink-0 px-6 pt-2">
        <Breadcrumbs items={breadcrumbItems} seo={false} />
        <PageHeader title={t("title")} description={t("description")} />
      </div>
      <div className="flex-1 flex flex-col min-h-0 px-6 pb-6">
        <ReviewsView counts={counts} />
      </div>
    </div>
  );
}
