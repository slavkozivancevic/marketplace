import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { getLocale, getTranslations } from "next-intl/server";
import { resolveRequestContext } from "@/lib/auth/resolveRequestContext";
import { requirePermission } from "@/lib/auth/permissions";
import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { OrgOrdersPage } from "@/features/orders/components/OrgOrdersPage";
import { getPathname } from "@/i18n/navigation";

export async function generateMetadata() {
  const t = await getTranslations("orgOrders");
  return { title: t("pageTitle") };
}

export default async function OrgOrdersRoute() {
  await connection();
  const t = await getTranslations("orgOrders");
  const tCrumbs = await getTranslations("breadcrumbs");
  const locale = await getLocale();
  const breadcrumbItems = [
    { name: tCrumbs("dashboard"), href: getPathname({ href: "/dashboard", locale }) },
    { name: tCrumbs("organization"), href: getPathname({ href: "/dashboard/organization", locale }) },
    { name: tCrumbs("receivedOrders"), href: getPathname({ href: "/dashboard/organization/orders", locale }) },
  ];

  let ctx;
  try {
    ctx = await resolveRequestContext();
  } catch {
    notFound();
  }

  try {
    requirePermission(ctx, "order:read");
  } catch {
    // The newly-active org doesn't grant access to this section - send the user
    // back to the dashboard instead of a dead-end 404 (e.g. after an org switch
    // that left them on a page their new role can't see).
    redirect(`/${locale}/dashboard`);
  }

  // The list is fetched client-side (OrgOrdersList via React Query), so we skip
  // a blocking SSR prefetch and let its own skeleton be the single loading state.
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="shrink-0 px-6 pt-2">
        <Breadcrumbs items={breadcrumbItems} seo={false} />
        <PageHeader title={t("pageTitle")} description={t("pageDescription")} />
      </div>
      <div className="flex-1 flex flex-col min-h-0 px-6 pb-6">
        <OrgOrdersPage />
      </div>
    </div>
  );
}
