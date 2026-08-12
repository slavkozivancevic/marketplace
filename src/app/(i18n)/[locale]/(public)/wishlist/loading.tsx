import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/PageHeader";
import { Footer } from "@/components/layout/footer";
import {
  SkeletonArray,
  SkeletonBreadcrumbs,
  SkeletonButton,
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
          <SkeletonButton className="w-40" />
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
