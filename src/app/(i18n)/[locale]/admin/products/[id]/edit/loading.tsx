import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/PageHeader";
import {
  SkeletonBreadcrumbs,
  SkeletonButton,
  SkeletonProductForm,
} from "@/components/ui/skeleton";

/**
 * The real header reads "Edit: {title}", which this state cannot know yet, so
 * it uses the title-less `editProductLoading` wording - a stable title beats a
 * placeholder bar that would swap to text and flash.
 *
 * The back action IS a placeholder though: it links to `/admin/products/[id]`
 * ("Back to product"), and a loading.tsx receives no route params, so it cannot
 * build that href. Pointing it at the products list instead would have been a
 * button that moves and relabels itself the moment the page lands.
 */
export default async function EditProductLoadingPage() {
  const t = await getTranslations();
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="shrink-0 px-6 pt-2 sticky-header-bg">
        <SkeletonBreadcrumbs segments={4} />
        <PageHeader
          title={t("admin.editProductLoading")}
          description={t("admin.editProductDesc")}
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
