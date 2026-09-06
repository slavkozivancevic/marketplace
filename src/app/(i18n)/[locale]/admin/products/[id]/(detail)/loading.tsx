import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import {
  SkeletonBreadcrumbs,
  SkeletonButton,
  SkeletonProductCard,
} from "@/components/ui/skeleton";

/**
 * The page renders its own <Suspense> fallback once it is running, but that
 * only helps after the RSC payload starts arriving. This boundary is what the
 * router shows the instant the link is clicked.
 *
 * The History and Edit actions are placeholders rather than real buttons: both
 * need the product id to build their href, and a loading.tsx receives no route
 * params.
 */
export default async function AdminProductLoadingPage() {
  const t = await getTranslations();
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="shrink-0 px-6 pt-2 sticky-header-bg">
        <SkeletonBreadcrumbs segments={3} />
        <PageHeader
          title={t("admin.productDetails")}
          description={t("common.loadingDetails")}
        >
          <Button asChild variant="outline">
            <Link href="/admin/products">{t("admin.backToProducts")}</Link>
          </Button>
          <SkeletonButton className="w-20" />
          <SkeletonButton className="w-16" />
        </PageHeader>
      </div>
      <div className="flex-1 overflow-y-auto min-h-0 px-6 pb-6">
        <SkeletonProductCard />
      </div>
    </div>
  );
}
