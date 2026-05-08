import { getTranslations } from "next-intl/server";
import { CheckoutPage } from "@/features/cart/components/CheckoutPage";

export async function generateMetadata() {
  const t = await getTranslations("checkout");
  return { title: t("title") };
}

export default function CheckoutRoute() {
  return <CheckoutPage />;
}