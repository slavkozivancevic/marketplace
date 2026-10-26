import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Link, getPathname } from "@/i18n/navigation";
import { resolveRequestContext } from "@/lib/auth/resolveRequestContext";
import { requirePermission } from "@/lib/auth/permissions";
import { MembershipRole, UserRole } from "@/generated/prisma/client";
import { NotFoundError } from "@/features/common/errors/domainErrors";
import { getProductTitle } from "@/features/products/utils/translations";
import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs, type BreadcrumbItem } from "@/components/seo/Breadcrumbs";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info } from "lucide-react";
import { VerificationRequiredNotice } from "@/components/VerificationRequiredNotice";
import { PRICE_RULES_PER_PRODUCT_MAX } from "../schema/priceRules";
import { toRuleInput } from "../schema/ruleMapping";
import { getPricingPageData, getRuleForEdit } from "../db/pricingPage";
import { getPriceMarketConfig } from "@/features/priceMarkets/db/markets";
import { getPriceMarketName } from "@/features/priceMarkets/utils/markets";
import { PriceRulesTable } from "./PriceRulesTable";
import { PriceCalendar } from "./PriceCalendar";
import { PriceRuleForm } from "./PriceRuleForm";
import { buildPricingListView } from "./pricingListView";
import { PriceRulesLink } from "./PriceRulesLink";
import type { PricingListShape } from "./PriceRulesListSkeleton";

export type PricingScope = "dashboard" | "admin";

/** Every path a pricing screen links to, per surface. */
const PATHS = {
  dashboard: {
    product: "/dashboard/my-products/[id]",
    list: "/dashboard/my-products/[id]/pricing",
    create: "/dashboard/my-products/[id]/pricing/new",
    edit: "/dashboard/my-products/[id]/pricing/[ruleId]/edit",
  },
  admin: {
    product: "/admin/products/[id]",
    list: "/admin/products/[id]/pricing",
    create: "/admin/products/[id]/pricing/new",
    edit: "/admin/products/[id]/pricing/[ruleId]/edit",
  },
} as const;

/**
 * Access, resolved the same way for both surfaces: the request context is
 * DB-authoritative for the active org, a platform admin acts within it (spec
 * Constraint 11), and a product outside that org is simply not found.
 */
async function access() {
  const ctx = await resolveRequestContext();
  requirePermission(ctx, "product:read");
  const isPlatformAdmin = ctx.userRole === UserRole.ADMIN;
  const canWrite =
    isPlatformAdmin ||
    ctx.membershipRole === MembershipRole.OWNER ||
    ctx.membershipRole === MembershipRole.ADMIN;
  return { ctx, canWrite, verified: isPlatformAdmin || ctx.organizationVerified };
}

async function loadPage(organizationId: string, productId: string) {
  try {
    return await getPricingPageData(organizationId, productId);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }
}

async function crumbs(scope: PricingScope, productId: string, productTitle: string, extra?: BreadcrumbItem) {
  const tCrumbs = await getTranslations("breadcrumbs");
  const locale = await getLocale();
  const p = PATHS[scope];
  const root: BreadcrumbItem[] =
    scope === "dashboard"
      ? [
          { name: tCrumbs("dashboard"), href: getPathname({ href: "/dashboard", locale }) },
          { name: tCrumbs("myProducts"), href: getPathname({ href: "/dashboard/my-products", locale }) },
        ]
      : [
          { name: tCrumbs("admin"), href: getPathname({ href: "/admin", locale }) },
          { name: tCrumbs("adminProducts"), href: getPathname({ href: "/admin/products", locale }) },
        ];
  return [
    ...root,
    { name: productTitle, href: getPathname({ href: { pathname: p.product, params: { id: productId } }, locale }) },
    { name: tCrumbs("priceRules"), href: getPathname({ href: { pathname: p.list, params: { id: productId } }, locale }) },
    ...(extra ? [extra] : []),
  ];
}

/**
 * The rules list's view and the viewer's rights for one product - what a page
 * linking to the list hands its skeleton (see PriceRulesLink). Null when the
 * product's pricing cannot be read; the link then just navigates.
 */
export async function getPricingListShape(productId: string): Promise<PricingListShape | null> {
  const locale = await getLocale();
  const { ctx, canWrite, verified } = await access();
  try {
    const data = await getPricingPageData(ctx.organizationId, productId);
    return { view: await buildPricingListView(data, locale), canWrite, verified };
  } catch (error) {
    if (error instanceof NotFoundError) return null;
    throw error;
  }
}

/** The rules list and the 60-day calendar of one product. */
export async function PriceRulesScreen({ scope, productId }: { scope: PricingScope; productId: string }) {
  const t = await getTranslations("priceRules");
  const locale = await getLocale();
  const { ctx, canWrite, verified } = await access();
  const data = await loadPage(ctx.organizationId, productId);
  const view = await buildPricingListView(data, locale);
  const { title, atLimit, hasMarketRules, scheduleRuleIds } = view;
  const p = PATHS[scope];
  const writable = canWrite && verified;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="shrink-0 px-6 pt-2 sticky-header-bg">
        <Breadcrumbs items={await crumbs(scope, productId, title)} seo={false} />
        <PageHeader title={t("title")} description={t("description", { title })}>
          <Button asChild variant="outline">
            <Link href={{ pathname: p.product, params: { id: productId } }}>{t("backToProduct")}</Link>
          </Button>
          {writable &&
            (atLimit ? (
              <Button disabled title={t("limitReached", { max: PRICE_RULES_PER_PRODUCT_MAX })}>
                {t("addRule")}
              </Button>
            ) : (
              <Button asChild>
                <Link href={{ pathname: p.create, params: { id: productId } }}>{t("addRule")}</Link>
              </Button>
            ))}
        </PageHeader>
      </div>
      <div className="flex-1 overflow-y-auto min-h-0 px-6 pb-6 space-y-6">
        {!canWrite && (
          <Alert>
            <Info />
            <AlertDescription>{t("readOnly")}</AlertDescription>
          </Alert>
        )}
        {canWrite && !verified && (
          <VerificationRequiredNotice title={t("verifyTitle")} description={t("verifyDesc")} />
        )}
        {writable && atLimit && (
          <Alert>
            <Info />
            <AlertDescription>{t("limitReached", { max: PRICE_RULES_PER_PRODUCT_MAX })}</AlertDescription>
          </Alert>
        )}
        <p className="text-sm text-muted-foreground">{t("sortNote")}</p>
        {/* Market rules are not on the calendar: they apply to their buyers
            always, on top of whatever the calendar shows - which this says once. */}
        {hasMarketRules && <p className="text-sm text-muted-foreground">{t("marketNote")}</p>}
        <PriceRulesTable
          rules={view.rules}
          variantSku={view.variantSku}
          marketNames={view.marketNames}
          canWrite={writable}
          editPathname={p.edit}
          productId={productId}
        />
        {/* Schedule rules only: a market rule is never on a calendar day, so a
            calendar of market rules alone was an empty strip with a legend
            colour that appears nowhere. */}
        {scheduleRuleIds.length > 0 && (
          <PriceCalendar
            rows={view.calendarRows}
            overlaps={view.overlaps}
            ruleOrder={scheduleRuleIds}
            ruleNames={view.ruleNames}
            rowLabels={view.rowLabels}
          />
        )}
      </div>
    </div>
  );
}

/** The create or edit form for one rule. */
export async function PriceRuleFormScreen({
  scope,
  productId,
  ruleId,
}: {
  scope: PricingScope;
  productId: string;
  ruleId?: string;
}) {
  const t = await getTranslations("priceRules");
  const tCrumbs = await getTranslations("breadcrumbs");
  const locale = await getLocale();
  const { ctx, canWrite, verified } = await access();
  if (!canWrite) notFound();
  const data = await loadPage(ctx.organizationId, productId);
  const title = getProductTitle(data, locale);
  const p = PATHS[scope];
  const listHref = { pathname: p.list, params: { id: productId } } as const;

  let rule: Parameters<typeof PriceRuleForm>[0]["rule"];
  if (ruleId) {
    try {
      const { rule: stored } = await getRuleForEdit(ctx.organizationId, ruleId);
      if (stored.productId !== productId) notFound();
      rule = {
        id: stored.id,
        input: toRuleInput(stored, stored.amountMoney, "usd"),
        storedAmount: stored.amountMoney,
      };
    } catch (error) {
      if (error instanceof NotFoundError) notFound();
      throw error;
    }
  }

  const marketConfig = await getPriceMarketConfig();
  const markets = marketConfig.markets.map((m) => ({
    id: m.id,
    name: getPriceMarketName(m, locale),
    isDefault: m.isDefault,
  }));
  // Country -> its market's name, so a country pick says which market it sits in.
  const countryMarket: Record<string, string> = {};
  for (const m of marketConfig.markets) {
    for (const c of m.countries) countryMarket[c] = getPriceMarketName(m, locale);
  }

  const here = ruleId
    ? { name: tCrumbs("editPriceRule"), href: getPathname({ href: { pathname: p.edit, params: { id: productId, ruleId } }, locale }) }
    : { name: tCrumbs("newPriceRule"), href: getPathname({ href: { pathname: p.create, params: { id: productId } }, locale }) };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="shrink-0 px-6 pt-2 sticky-header-bg">
        <Breadcrumbs items={await crumbs(scope, productId, title, here)} seo={false} />
        <PageHeader title={ruleId ? t("editTitle") : t("newTitle")} description={title}>
          <PriceRulesLink
            href={listHref}
            productId={productId}
            shape={{ view: await buildPricingListView(data, locale), canWrite, verified }}
          >
            {t("backToRules")}
          </PriceRulesLink>
        </PageHeader>
      </div>
      <div className="flex-1 overflow-y-auto min-h-0 px-6 pb-6">
        {!verified ? (
          <VerificationRequiredNotice title={t("verifyTitle")} description={t("verifyDesc")} />
        ) : (
          <PriceRuleForm
            productId={productId}
            listPath={getPathname({ href: listHref, locale }).replace(new RegExp(`^/${locale}`), "")}
            variants={data.variants.map((v) => ({ id: v.id, sku: v.sku }))}
            markets={markets}
            countryMarket={countryMarket}
            defaultMarketName={markets.find((m) => m.isDefault)?.name ?? ""}
            rule={rule}
          />
        )}
      </div>
    </div>
  );
}
