import { getLocale, getTranslations } from "next-intl/server";
import { getPathname } from "@/i18n/navigation";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { Footer } from "@/components/layout/footer";
import { WishlistLoading as WishlistLoadingBody } from "@/features/wishlist/components/WishlistLoading";

/**
 * The trail is static copy, so it is the real one; the rest is
 * <WishlistLoading>, which knows the wishlist's size from the header's cached
 * ids and draws exactly what the page will (cards, the empty state or the
 * demo panel).
 */
export default async function WishlistLoading() {
  const locale = await getLocale();
  const tCrumbs = await getTranslations("breadcrumbs");
  return (
    <WishlistLoadingBody
      trail={
        <Breadcrumbs
          items={[
            { name: tCrumbs("home"), href: getPathname({ href: "/", locale }) },
            { name: tCrumbs("wishlist"), href: getPathname({ href: "/wishlist", locale }) },
          ]}
          seo={false}
        />
      }
      footer={<Footer />}
    />
  );
}
