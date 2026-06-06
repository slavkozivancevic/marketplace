import { getLocale, getTranslations } from "next-intl/server";
import { getPathname } from "@/i18n/navigation";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { CheckoutPage } from "@/features/cart/components/CheckoutPage";

export async function generateMetadata() {
  const t = await getTranslations("checkout");
  return { title: t("title") };
}

export default async function CheckoutRoute() {
  const locale = await getLocale();
  const tCrumbs = await getTranslations("breadcrumbs");
  const breadcrumbItems = [
    { name: tCrumbs("home"), href: getPathname({ href: "/", locale }) },
    { name: tCrumbs("checkout"), href: getPathname({ href: "/checkout", locale }) },
  ];

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="shrink-0 px-6 pt-2">
        <Breadcrumbs items={breadcrumbItems} seo={false} />
      </div>
      <CheckoutPage />
    </div>
  );
}
