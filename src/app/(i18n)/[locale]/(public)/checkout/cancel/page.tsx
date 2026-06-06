import { Link, getPathname } from "@/i18n/navigation";
import { XCircle } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { Footer } from "@/components/layout/footer";

export default async function CheckoutCancelPage() {
  const t = await getTranslations();
  const tCrumbs = await getTranslations("breadcrumbs");
  const locale = await getLocale();
  const breadcrumbItems = [
    { name: tCrumbs("home"), href: getPathname({ href: "/", locale }) },
    { name: tCrumbs("checkout"), href: getPathname({ href: "/checkout", locale }) },
    { name: tCrumbs("orderCancelled"), href: getPathname({ href: "/checkout/cancel", locale }) },
  ];

  return (
    <>
      <div className="shrink-0 px-6 pt-2">
        <Breadcrumbs items={breadcrumbItems} seo={false} />
      </div>
      <div className="flex-1 overflow-y-auto min-h-0 flex flex-col">
        <div className="flex-1 px-6 py-16 text-center space-y-6 max-w-md mx-auto w-full">
          <div className="flex justify-center">
            <XCircle className="h-16 w-16 text-destructive" />
          </div>
          <h1 className="text-2xl font-bold">{t("checkout.paymentCancelled")}</h1>
          <p className="text-muted-foreground text-sm">
            {t("checkout.cartSaved")}
          </p>
          <div className="flex flex-col gap-3">
            <Button asChild>
              <Link href="/products">{t("checkout.backToProducts")}</Link>
            </Button>
          </div>
        </div>
        <Footer />
      </div>
    </>
  );
}
