import { Link, getPathname } from "@/i18n/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { ProductDetailLoadingHeader } from "@/features/products/components/ProductDetailsLoadingParts";
import { Button } from "@/components/ui/button";
import { SkeletonButton } from "@/components/ui/skeleton";
import { ProductDetailsSkeleton } from "@/features/products/components/ProductDetailsSkeleton";

/**
 * The page renders its own <Suspense> fallback once it is running, but that
 * only helps after the RSC payload starts arriving. This boundary is what the
 * router shows the instant the link is clicked.
 *
 * The History, Price rules and Edit actions are placeholders rather than real
 * buttons: all three need the product id to build their href, and a
 * loading.tsx receives no route params. One placeholder per real button, in
 * the same order - a missing one makes the header jump when the page arrives.
 */
export default async function AdminProductLoadingPage() {
  const t = await getTranslations();
  const tCrumbs = await getTranslations("breadcrumbs");
  const locale = await getLocale();
  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* The clicked list row's title when it recorded the product;
          placeholder crumbs otherwise. */}
      <ProductDetailLoadingHeader
        area="admin"
        placeholderCrumbs
        baseCrumbs={[
          { name: tCrumbs("admin"), href: getPathname({ href: "/admin", locale }) },
          { name: tCrumbs("adminProducts"), href: getPathname({ href: "/admin/products", locale }) },
        ]}
        genericTitle={t("admin.productDetails")}
        genericCrumb={tCrumbs("productDetails")}
        description={t("admin.productDetailsDesc")}
      >
        <Button asChild variant="outline">
          <Link href="/admin/products">{t("admin.backToProducts")}</Link>
        </Button>
        <SkeletonButton label={t("admin.history")} />
        <SkeletonButton label={t("priceRules.title")} />
        <SkeletonButton label={t("common.edit")} />
      </ProductDetailLoadingHeader>
      <div className="flex-1 overflow-y-auto min-h-0 px-6 pb-6">
        <ProductDetailsSkeleton />
      </div>
    </div>
  );
}
