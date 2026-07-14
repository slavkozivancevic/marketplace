import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getLocale, getTranslations } from "next-intl/server";
import { cacheTag } from "next/cache";
import { prisma } from "@/core/db/prisma";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { Link, getPathname } from "@/i18n/navigation";
import { MyProductsPage } from "@/features/products/components/MyProductsPage";
import { getAllBrands } from "@/features/brands/db/brands";
import { CacheTags } from "@/lib/cache/tags";

async function fetchBrands() {
  "use cache";
  cacheTag(CacheTags.brands.all());
  return getAllBrands();
}

export default async function MyProductsRoute() {
  await connection();
  const t = await getTranslations();
  const tCrumbs = await getTranslations("breadcrumbs");
  const locale = await getLocale();
  const { userId } = await auth();
  const breadcrumbItems = [
    { name: tCrumbs("dashboard"), href: getPathname({ href: "/dashboard", locale }) },
    { name: tCrumbs("myProducts"), href: getPathname({ href: "/dashboard/my-products", locale }) },
  ];

  const user = await prisma.user.findUnique({
    where: { clerkUserId: userId! },
    select: {
      role: true,
      activeOrgId: true,
      memberships: {
        select: {
          orgId: true,
          role: true,
          organization: { select: { verified: true } },
        },
      },
    },
  });

  if (!user || user.role !== "SELLER") {
    redirect(`/${locale}/dashboard`);
  }

  if (!user.activeOrgId) {
    redirect(`/${locale}/dashboard`);
  }

  const activeMembership = user.memberships.find(
    (m) => m.orgId === user.activeOrgId,
  );

  const canWrite =
    activeMembership?.role === "OWNER" || activeMembership?.role === "ADMIN";
  const orgVerified = activeMembership?.organization?.verified ?? false;

  // The list is fetched client-side (MyProductsList via React Query with
  // `refetchOnMount: "always"`), so we skip a blocking SSR prefetch and let its
  // own skeleton be the single loading state.
  const brands = await fetchBrands();

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="shrink-0 px-6 pt-2">
        <Breadcrumbs items={breadcrumbItems} seo={false} />
        <PageHeader
          title={t("myProducts.title")}
          description={t("myProducts.manage")}
        >
          {canWrite && orgVerified && (
            <Button asChild>
              <Link href="/dashboard/my-products/new">{t("myProducts.create")}</Link>
            </Button>
          )}
        </PageHeader>
      </div>
      <div className="flex-1 flex flex-col min-h-0 px-6 pb-6">
        {canWrite && !orgVerified && (
          <Alert className="mb-4">
            <ShieldAlert />
            <AlertTitle>{t("myProducts.verifyRequiredTitle")}</AlertTitle>
            <AlertDescription>{t("myProducts.verifyPendingBanner")}</AlertDescription>
          </Alert>
        )}
        <MyProductsPage canWrite={canWrite} brands={brands} />
      </div>
    </div>
  );
}
