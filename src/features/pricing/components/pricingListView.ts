import { getTranslations } from "next-intl/server";
import { getProductTitle } from "@/features/products/utils/translations";
import { getPriceMarketConfig } from "@/features/priceMarkets/db/markets";
import { getPriceMarketName } from "@/features/priceMarkets/utils/markets";
import { PRICE_RULES_PER_PRODUCT_MAX } from "../schema/priceRules";
import { buildCalendar, findOverlaps, ruleStatus, type CalendarRow, type RuleOverlap } from "../engine/calendar";
import { zonedParts } from "../engine/timezone";
import { getVariantLabel } from "@/features/attributes/utils/translations";
import type { PricingPageData } from "../db/pricingPage";
import type { RuleRow } from "./PriceRulesTable";

export const CALENDAR_DAYS = 60;
const CALENDAR_TZ = "Europe/Belgrade";

/**
 * Everything the price-rules list draws, derived once from the page data: the
 * table's rows, the 60-day calendar, its overlaps and labels. The list screen
 * renders from it, and the pages that link to the list (product details, the
 * rule form) hand it to the list's skeleton on the click - so the skeleton
 * draws the same rows, notes and calendar the list is about to show.
 */
export type PricingListView = {
  title: string;
  rules: RuleRow[];
  variantSku: Record<string, string>;
  ruleNames: Record<string, string>;
  marketNames: Record<string, string>;
  rowLabels: Record<string, string>;
  calendarRows: CalendarRow[];
  overlaps: RuleOverlap[];
  /** Schedule rules only - a market rule is never on a calendar day. */
  scheduleRuleIds: string[];
  hasMarketRules: boolean;
  atLimit: boolean;
};

export async function buildPricingListView(data: PricingPageData, locale: string): Promise<PricingListView> {
  const t = await getTranslations("priceRules");
  const now = new Date();
  const today = zonedParts(now.getTime(), CALENDAR_TZ);
  const targets = [
    { productId: data.productId, variantId: null, baseMoney: data.baseMoney },
    ...data.variants.map((v) => ({ productId: data.productId, variantId: v.id, baseMoney: v.baseMoney })),
  ];
  const markets = await getPriceMarketConfig();

  return {
    title: getProductTitle(data, locale),
    rules: data.rules.map((r) => ({ ...r, status: ruleStatus(r, now) })),
    variantSku: Object.fromEntries(data.variants.map((v) => [v.id, v.sku])),
    ruleNames: Object.fromEntries(data.rules.map((r) => [r.id, r.name])),
    marketNames: Object.fromEntries(markets.markets.map((m) => [m.id, getPriceMarketName(m, locale)])),
    rowLabels: {
      "": t("wholeProduct"),
      ...Object.fromEntries(
        data.variants.map((v) => [v.id, getVariantLabel(v, locale) ?? t("variant", { sku: v.sku })]),
      ),
    },
    calendarRows: buildCalendar(targets, data.rules, today, CALENDAR_DAYS, CALENDAR_TZ),
    overlaps: findOverlaps(data.rules, now, new Date(now.getTime() + CALENDAR_DAYS * 86_400_000)),
    scheduleRuleIds: data.rules.filter((r) => r.kind === "SCHEDULE").map((r) => r.id),
    hasMarketRules: data.rules.some((r) => r.kind === "REGION"),
    atLimit: data.rules.length >= PRICE_RULES_PER_PRODUCT_MAX,
  };
}
