import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { SkeletonBreadcrumbs } from "@/components/ui/skeleton";
import { CouponFormSkeleton } from "@/features/coupons/components/CouponFormSkeleton";

/**
 * The real header reads "Edit: {code}". `editCoupon` is the existing code-less
 * wording - see the note in ../../../brands/[id]/edit/loading.tsx.
 */
export default async function EditCouponLoadingPage() {
  const t = await getTranslations("coupons");
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="shrink-0 px-6 pt-2 sticky-header-bg">
        <SkeletonBreadcrumbs segments={3} />
        <PageHeader title={t("editCoupon")} description={t("formDescription")}>
          <Button asChild variant="outline">
            <Link href="/admin/coupons">{t("back")}</Link>
          </Button>
        </PageHeader>
      </div>
      <div className="flex-1 overflow-y-auto min-h-0 px-6 pb-6">
        <CouponFormSkeleton mode="edit" />
      </div>
    </div>
  );
}
