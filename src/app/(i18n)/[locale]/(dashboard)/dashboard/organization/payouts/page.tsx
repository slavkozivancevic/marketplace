import { notFound } from "next/navigation";
import { getTranslations, getLocale } from "next-intl/server";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { createSearchParamsCache } from "nuqs/server";
import { AlertCircle } from "lucide-react";
import { resolveRequestContext } from "@/lib/auth/resolveRequestContext";
import { MembershipRole } from "@/generated/prisma/client";
import { getPathname } from "@/i18n/navigation";
import { getQueryClient } from "@/lib/query/getQueryClient";
import { orgPayoutSearchParams } from "@/lib/query/searchParams";
import { LIST_PAGE_SIZE } from "@/constants/queryConstants";
import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  syncConnectStatus,
  type ConnectStatus,
} from "@/features/payments/actions/connect";
import { getOrgPayoutsPage } from "@/features/payments/db/payouts";
import { ConnectPayouts } from "@/features/payments/components/ConnectPayouts";
import { OrgPayoutsPage } from "@/features/payments/components/OrgPayoutsPage";

const searchParamsCache = createSearchParamsCache(orgPayoutSearchParams);

const DISCONNECTED: ConnectStatus = {
  connected: false,
  chargesEnabled: false,
  payoutsEnabled: false,
  detailsSubmitted: false,
};

export default async function PayoutsRoute({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const t = await getTranslations("payouts");
  const tCrumbs = await getTranslations("breadcrumbs");
  const locale = await getLocale();

  let ctx;
  try {
    ctx = await resolveRequestContext();
  } catch {
    notFound();
  }

  const canManage =
    ctx.membershipRole === MembershipRole.OWNER ||
    ctx.membershipRole === MembershipRole.ADMIN;
  if (!canManage) notFound();

  const breadcrumbItems = [
    { name: tCrumbs("dashboard"), href: getPathname({ href: "/dashboard", locale }) },
    { name: tCrumbs("organization"), href: getPathname({ href: "/dashboard/organization", locale }) },
    { name: t("pageTitle"), href: getPathname({ href: "/dashboard/organization/payouts", locale }) },
  ];

  const params = searchParamsCache.parse(await searchParams);
  const filters = {
    search: params.search,
    sortBy: params.sortBy,
    sortOrder: params.sortOrder,
    status: params.status.length > 0 ? params.status : undefined,
    refunded: params.refunded.length > 0 ? params.refunded : undefined,
  };

  let status: ConnectStatus | null = null;
  const queryClient = getQueryClient();
  if (ctx.organizationVerified) {
    const res = await syncConnectStatus();
    status = "error" in res ? DISCONNECTED : res;

    await queryClient.prefetchInfiniteQuery({
      queryKey: ["payouts", "org", { ...filters, status: params.status, refunded: params.refunded }],
      queryFn: () =>
        getOrgPayoutsPage({
          organizationId: ctx.organizationId,
          take: LIST_PAGE_SIZE,
          ...filters,
        }),
      initialPageParam: undefined as string | undefined,
    });
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="shrink-0 px-6 pt-2">
        <Breadcrumbs items={breadcrumbItems} seo={false} />
        <PageHeader title={t("pageTitle")} description={t("pageDescription")} />
      </div>

      <div className="flex-1 flex flex-col min-h-0 px-6 pb-6 gap-5">
        {ctx.organizationVerified ? (
          <>
            <div className="shrink-0">
              <ConnectPayouts status={status ?? DISCONNECTED} />
            </div>
            <HydrationBoundary state={dehydrate(queryClient)}>
              <OrgPayoutsPage />
            </HydrationBoundary>
          </>
        ) : (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>{t("verifyFirstTitle")}</AlertTitle>
            <AlertDescription>{t("verifyFirstDesc")}</AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  );
}
