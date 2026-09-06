import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Footer } from "@/components/layout/footer";
import {
  SkeletonArray,
  SkeletonBreadcrumbs,
  SkeletonProductGridCard,
} from "@/components/ui/skeleton";

export default async function WishlistLoading() {
  const t = await getTranslations();
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="shrink-0 px-6 pt-2 sticky-header-bg">
        <SkeletonBreadcrumbs />
        <PageHeader
          title={t("wishlist.title")}
          description={t("wishlist.savedPlaceholder")}
        >
          {/* Static href and label, so render the real button - a
              placeholder here would resize on handoff. */}
          <Button asChild variant="outline">
            <Link href="/products">{t("wishlist.continueShopping")}</Link>
          </Button>
        </PageHeader>
      </div>
      <div className="flex-1 overflow-y-auto min-h-0 flex flex-col">
        <div className="flex-1 px-6 pb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            <SkeletonArray amount={8}>
              <SkeletonProductGridCard showButton={false} />
            </SkeletonArray>
          </div>
        </div>
        <Footer />
      </div>
    </div>
  );
}
