import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { SkeletonBreadcrumbs, SkeletonProductCard } from "@/components/ui/skeleton";

/**
 * See ../../../../../admin/products/[id]/(detail)/loading.tsx - the page has its own
 * <Suspense> fallback, but this is what the router shows before the payload
 * arrives. The Edit action is omitted rather than placeheld: it only renders
 * for OWNER/ADMIN members, so a placeholder would promise a button that may
 * never appear.
 */
export default async function MyProductLoadingPage() {
  const t = await getTranslations();
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="shrink-0 px-6 pt-2 sticky-header-bg">
        <SkeletonBreadcrumbs segments={3} />
        <PageHeader
          title={t("myProducts.viewProduct")}
          description={t("myProducts.viewProductDesc")}
        >
          <Button asChild variant="outline">
            <Link href="/dashboard/my-products">{t("myProducts.backTo")}</Link>
          </Button>
        </PageHeader>
      </div>
      <div className="flex-1 overflow-y-auto min-h-0 px-6 pb-6">
        <SkeletonProductCard />
      </div>
    </div>
  );
}
