import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/PageHeader";
import {
  SkeletonBreadcrumbs,
  SkeletonButton,
  SkeletonProductForm,
} from "@/components/ui/skeleton";

/**
 * Back action is a placeholder - see the note in
 * ../../../../../admin/products/[id]/edit/loading.tsx. The real button reads
 * "Back to product" and needs the id to build its href.
 */
export default async function MyProductEditLoadingPage() {
  const t = await getTranslations();
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="shrink-0 px-6 pt-2 sticky-header-bg">
        <SkeletonBreadcrumbs segments={4} />
        <PageHeader
          title={t("myProducts.edit")}
          description={t("myProducts.editDesc")}
        >
          <SkeletonButton className="w-32" />
        </PageHeader>
      </div>
      <div className="flex-1 flex flex-col min-h-0 px-6">
        <SkeletonProductForm mode="edit" />
      </div>
    </div>
  );
}
