import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { getTranslations, getLocale } from "next-intl/server";
import { AlertCircle, Wallet } from "lucide-react";
import { resolveRequestContext } from "@/lib/auth/resolveRequestContext";
import { canManageOrgPayouts } from "@/lib/auth/permissions";
import { getPathname } from "@/i18n/navigation";
import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  syncConnectStatus,
  type ConnectStatus,
} from "@/features/payments/actions/connect";
import { ConnectPayouts } from "@/features/payments/components/ConnectPayouts";
import { OrgPayoutsPage } from "@/features/payments/components/OrgPayoutsPage";
import { getOrgCodBalances } from "@/features/payments/db/payouts";
import { formatPrice } from "@/lib/currency";
import type { Currency } from "@/lib/currency-config";

const DISCONNECTED: ConnectStatus = {
  connected: false,
  chargesEnabled: false,
  payoutsEnabled: false,
  detailsSubmitted: false,
};

export default async function PayoutsRoute() {
  await connection();
  const t = await getTranslations("payouts");
  const tCrumbs = await getTranslations("breadcrumbs");
  const locale = await getLocale();

  let ctx;
  try {
    ctx = await resolveRequestContext();
  } catch {
    notFound();
  }

  // The newly-active org doesn't grant payout access to this role - send the
  // user back to the dashboard rather than a dead-end 404.
  if (!canManageOrgPayouts(ctx.membershipRole)) redirect(`/${locale}/dashboard`);

  const breadcrumbItems = [
    { name: tCrumbs("dashboard"), href: getPathname({ href: "/dashboard", locale }) },
    { name: tCrumbs("organization"), href: getPathname({ href: "/dashboard/organization", locale }) },
    { name: t("pageTitle"), href: getPathname({ href: "/dashboard/organization/payouts", locale }) },
  ];

  // Connect status is a Stripe round-trip. The payouts list itself is fetched
  // client-side (OrgPayoutsList via React Query), so we do NOT SSR-prefetch it -
  // that avoids a double skeleton (a blocking prefetch would flash a loading.tsx
  // while the client re-fetches and shows its own skeleton anyway).
  let status: ConnectStatus | null = null;
  let codBalances: { currency: string; owedAmount: number }[] = [];
  if (ctx.organizationVerified) {
    const res = await syncConnectStatus();
    status = "error" in res ? DISCONNECTED : res;
    codBalances = await getOrgCodBalances(ctx.organizationId);
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="shrink-0 px-6 pt-2 sticky-header-bg">
        <Breadcrumbs items={breadcrumbItems} seo={false} />
        <PageHeader title={t("pageTitle")} description={t("pageDescription")} />
      </div>

      <div className="flex-1 flex flex-col min-h-0 px-6 pb-6 gap-5">
        {ctx.organizationVerified ? (
          <>
            <div className="shrink-0">
              <ConnectPayouts status={status ?? DISCONNECTED} />
            </div>
            {codBalances.length > 0 && (
              <Alert className="shrink-0">
                <Wallet className="h-4 w-4" />
                <AlertTitle>{t("codBalanceTitle")}</AlertTitle>
                <AlertDescription>
                  <div className="space-y-1">
                    {codBalances.map((b) => (
                      <div key={b.currency} className="font-semibold">
                        {formatPrice(b.owedAmount, b.currency as Currency)}
                      </div>
                    ))}
                  </div>
                  <p className="mt-1">{t("codBalanceDesc")}</p>
                </AlertDescription>
              </Alert>
            )}
            <OrgPayoutsPage />
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
