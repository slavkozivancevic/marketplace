import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { SkeletonBreadcrumbs, SkeletonButton } from "@/components/ui/skeleton";
import { ProductDetailsSkeleton } from "@/features/products/components/ProductDetailsSkeleton";

/**
 * See ../../../../../admin/products/[id]/(detail)/loading.tsx - the page has its own
 * <Suspense> fallback, but this is what the router shows before the payload
 * arrives. Price rules get a placeholder: every member sees that button
 * (read-only for a viewer), and without one the header jumped when it arrived.
 * Edit and the status actions only render for OWNER/ADMIN members - but those
 * are who open this page (the demo seller is one), so they are placeheld too;
 * a read-only member is the rare case that sees them go.
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
          <SkeletonButton label={t("priceRules.title")} />
          <SkeletonButton label={t("common.edit")} />
        </PageHeader>
      </div>
      <div className="flex-1 overflow-y-auto min-h-0 px-6 pb-6">
        <ProductDetailsSkeleton />
      </div>
    </div>
  );
}
