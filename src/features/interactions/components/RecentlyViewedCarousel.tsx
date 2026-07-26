import { getTranslations } from "next-intl/server";
import { getRecentlyViewed } from "@/features/interactions/db/interactions";
import { resolveInteractionIdentity } from "@/features/interactions/identity";
import { RelatedProductsCarousel } from "@/features/products/components/RelatedProductsCarousel";

/**
 * Personalized "Recently viewed" strip. Server-rendered (identity comes from
 * cookies, so it can't be part of the cached page render) but wrapped in its
 * own <Suspense> boundary by the caller - that lets this dynamic slice stream
 * in with the initial response while the rest of the product page stays
 * statically cacheable, instead of the old client-side fetch-after-hydration
 * round trip that made it pop in visibly late.
 */
export async function RecentlyViewedCarousel({
  excludeProductId,
}: {
  excludeProductId?: string;
}) {
  const t = await getTranslations("interactions");
  const identity = await resolveInteractionIdentity({ allowSet: false });
  const products = await getRecentlyViewed({ identity, excludeProductId });

  if (products.length === 0) return null;

  return (
    <RelatedProductsCarousel
      products={products}
      eyebrow={t("recentlyViewedEyebrow")}
      title={t("recentlyViewed")}
      showViewAll={false}
      autoplay={false}
    />
  );
}
