import { getLocale, getTranslations } from "next-intl/server";
import { getPathname } from "@/i18n/navigation";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { CartPage } from "@/features/cart/components/CartPage";
import { TrustStrip } from "@/features/trustPoints/components/TrustStrip";
import { DemoBuyerOnlyGate } from "@/features/demo/components/DemoBuyerOnlyNotice";

export async function generateMetadata() {
  const t = await getTranslations("cart");
  // Nothing here is worth a search result: the page renders one visitor's own
  // cart, held in their browser, and an indexed URL would only ever show an
  // empty one to the crawler.
  return { title: t("pageTitle"), robots: { index: false, follow: true } };
}

export default async function CartRoute() {
  const locale = await getLocale();
  const tCrumbs = await getTranslations("breadcrumbs");
  const breadcrumbItems = [
    { name: tCrumbs("home"), href: getPathname({ href: "/", locale }) },
    { name: tCrumbs("cart"), href: getPathname({ href: "/cart", locale }) },
  ];

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="shrink-0 px-6 pt-2 sticky-header-bg">
        {/* `seo={false}`: the cart is noindex, so emitting BreadcrumbList
            structured data for it would describe a page no crawler should
            reach. Same call as checkout. */}
        <Breadcrumbs items={breadcrumbItems} seo={false} />
      </div>
      <div className="flex-1 overflow-y-auto min-h-0">
        {/* The demo seller and admin have no cart - see demoAccounts.ts. */}
        <DemoBuyerOnlyGate className="py-16">
          <CartPage />
        </DemoBuyerOnlyGate>
        {/* Reassurance where it is actually needed - the step before paying.
            Server-rendered under the client cart, so it costs the cart nothing
            and disappears entirely when no point is active. */}
        <TrustStrip className="mx-auto w-full max-w-5xl px-6 pb-8" />
      </div>
    </div>
  );
}
