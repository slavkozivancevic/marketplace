import { getLocale, getTranslations } from "next-intl/server";
import { getPathname } from "@/i18n/navigation";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { CartPageLoading } from "@/features/cart/components/CartPage";

/**
 * Cart page skeleton.
 *
 * Returns a FRAGMENT: the `(public)` layout's <main> is the flex column, so
 * wrapping this in another `flex-1 flex flex-col` would add a nesting level the
 * real page does not have. The body is shared with `CartPage`, which shows it
 * while the persisted cart is still being read - see `CartPageLoading`.
 */
export default async function CartLoading() {
  const locale = await getLocale();
  const tCrumbs = await getTranslations("breadcrumbs");
  return (
    <>
      <div className="shrink-0 px-6 pt-2 sticky-header-bg">
        {/* The trail is static copy, so it is the real one - a bar per
            crumb could only guess each word's width. */}
        <Breadcrumbs
          items={[
            { name: tCrumbs("home"), href: getPathname({ href: "/", locale }) },
            { name: tCrumbs("cart"), href: getPathname({ href: "/cart", locale }) },
          ]}
          seo={false}
        />
      </div>
      <div className="flex-1 overflow-y-auto min-h-0">
        <CartPageLoading />
      </div>
    </>
  );
}
