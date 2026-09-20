import { safeAuth } from "@/lib/auth/safeAuth";
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
import { pickActiveMembership } from "@/features/organizations/db/activeOrg";
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
  const { userId } = await safeAuth();
  const breadcrumbItems = [
    { name: tCrumbs("dashboard"), href: getPathname({ href: "/dashboard", locale }) },
    { name: tCrumbs("myProducts"), href: getPathname({ href: "/dashboard/my-products", locale }) },
  ];

  // Null-safe for the same reason as the dashboard home page: the layout's
  // redirect races this render, so a signed-out HEAD would otherwise reach
  // Prisma with a null `clerkUserId`. See safeAuth.ts. The `!user` guard below
  // already sends anyone without a row back to /dashboard.
  const user = userId
    ? await prisma.user.findUnique({
        where: { clerkUserId: userId },
        select: {
          role: true,
          activeOrgId: true,
          memberships: {
            select: {
              orgId: true,
              role: true,
              createdAt: true,
              organization: { select: { verified: true } },
            },
          },
        },
      })
    : null;

  if (!user || user.role !== "SELLER") {
    redirect(`/${locale}/dashboard`);
  }

  // Resolved from the memberships rather than read straight off
  // `user.activeOrgId`: that column has no foreign key behind it, and when it
  // named an org whose membership was gone, this page found no membership at
  // all and told the owner of her own shop she had read-only access. Removal
  // now repoints the column, and this keeps the page right either way.
  const activeMembership = pickActiveMembership(
    user.activeOrgId,
    user.memberships,
  );

  if (!activeMembership) {
    redirect(`/${locale}/dashboard`);
  }
  const activeOrgId = activeMembership.orgId;

  const canWrite =
    activeMembership.role === "OWNER" || activeMembership.role === "ADMIN";
  const orgVerified = activeMembership.organization.verified;

  // The list is fetched client-side (MyProductsList via React Query with
  // `refetchOnMount: "always"`), so we skip a blocking SSR prefetch and let its
  // own skeleton be the single loading state.
  const [brands, members] = await Promise.all([
    fetchBrands(),
    fetchOrgMembers(activeOrgId),
  ]);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="shrink-0 px-6 pt-2 sticky-header-bg">
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
        <MyProductsPage canWrite={canWrite} brands={brands} members={members} />
      </div>
    </div>
  );
}

/**
 * Org members for the "Created by" filter's option labels - not `"use cache"`,
 * since membership changes (removals, role swaps) should show up immediately
 * rather than sit behind a cache tag nothing currently invalidates for this
 * specific list shape.
 */
async function fetchOrgMembers(organizationId: string) {
  const memberships = await prisma.membership.findMany({
    where: { orgId: organizationId },
    select: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "asc" },
  });
  return memberships.map((m) => m.user);
}
