import Link from "next/link";
import { XCircle } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Footer } from "@/components/layout/footer";

export default async function CheckoutCancelPage() {
  const t = await getTranslations();
  return (
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
  );
}
