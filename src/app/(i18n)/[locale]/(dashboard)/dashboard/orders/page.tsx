import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { getLocale, getTranslations } from "next-intl/server";
import { prisma } from "@/core/db/prisma";
import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { OrdersPage } from "@/features/orders/components/OrdersPage";
import { getPathname } from "@/i18n/navigation";

export default async function OrdersRoute() {
  await connection();
  const t = await getTranslations();
  const tCrumbs = await getTranslations("breadcrumbs");
  const locale = await getLocale();
  const breadcrumbItems = [
    { name: tCrumbs("dashboard"), href: getPathname({ href: "/dashboard", locale }) },
    { name: tCrumbs("myOrders"), href: getPathname({ href: "/dashboard/orders", locale }) },
  ];
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) notFound();

  const user = await prisma.user.findUnique({
    where: { clerkUserId },
    select: { id: true },
  });
  if (!user) notFound();

  // The list is fetched client-side (OrdersList via React Query), so we skip a
  // blocking SSR prefetch and let its own skeleton be the single loading state.
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="shrink-0 px-6 pt-2">
        <Breadcrumbs items={breadcrumbItems} seo={false} />
        <PageHeader title={t("orders.title")} description={t("orders.history")} />
      </div>
      <div className="flex-1 flex flex-col min-h-0 px-6 pb-6">
        <OrdersPage />
      </div>
    </div>
  );
}
