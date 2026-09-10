import { prisma } from "@/core/db/prisma";
import { resolveCart, type CartItemRef, type ResolvedCartLine } from "@/features/cart/db/resolveCart";
import { cartSubtotalIn } from "@/features/cart/db/resolveCart";
import { moneyIn, parseMoney, type MoneySet } from "@/lib/money";
import type { MoneyContext } from "@/features/currency/db/activeCurrency";
import type { Currency } from "@/lib/currency-config";

/** Cart line reference - prices are always read from the DB, never the client. */
export type ShippingCartItem = CartItemRef;

/**
 * Per-seller delivery line for one cart: the org's rule, its subtotal, and the
 * resulting shipping fee.
 *
 * Everything a buyer sees or pays is in `currency`, the currency they are
 * shopping in - including the free-shipping comparison. The seller set that
 * threshold as a real amount in a real currency ("free over 5.000 RSD"), so it
 * is applied as that amount. Evaluating it against a converted USD figure
 * instead is what let a cart sitting exactly on the threshold fall a dinar
 * short of it.
 *
 * The `*Usd` fields are the USD-cent mirrors, kept for records and for
 * cross-currency reporting. They are never what decides the charge.
 */
export type OrgShippingLine = {
  orgId: string;
  orgName: string;
  /** The currency every non-`*Usd` amount below is expressed in. */
  currency: Currency;
  /** This seller's cart subtotal, in `currency`. */
  subtotal: number;
  /** The seller's flat fee, in `currency`. */
  flatRate: number;
  /** Free-shipping threshold in `currency`; null = never free. */
  freeThreshold: number | null;
  /** Charged shipping for this seller, in `currency` (0 when free / no fee). */
  shipping: number;
  subtotalUsd: number;
  flatRateUsd: number;
  freeThresholdUsd: number | null;
  shippingUsd: number;
  /** The charged fee as an exact per-currency set; null when nothing is due. */
  shippingMoney: MoneySet | null;
};

/**
 * Resolves the per-seller delivery for a cart. Items are grouped by owning
 * organization; each org charges its `shippingFlatRate`, waived once that org's
 * subtotal reaches `shippingFreeThreshold` (null threshold = never free). The
 * fee is the seller's - no platform fee, and coupons never touch it.
 */
export async function cartShippingLines(
  items: ShippingCartItem[],
  ctx: MoneyContext,
): Promise<OrgShippingLine[]> {
  const { lines } = await resolveCart(items);
  return shippingLinesForResolved(lines, ctx);
}

/**
 * Per-seller delivery for an already-resolved cart. Lets callers that have
 * already run {@link resolveCart} (e.g. to also read `unavailable`) avoid a
 * second resolution pass.
 */
export async function shippingLinesForResolved(
  resolved: ResolvedCartLine[],
  ctx: MoneyContext,
): Promise<OrgShippingLine[]> {
  if (resolved.length === 0) return [];

  const { currency, rates } = ctx;

  // Subtotal per owning org, in both the buyer's currency (what the threshold
  // is judged against) and USD (the mirror kept on the line for records).
  const linesByOrg = new Map<string, ResolvedCartLine[]>();
  const orgSubtotalUsd = new Map<string, number>();
  for (const line of resolved) {
    const group = linesByOrg.get(line.organizationId);
    if (group) group.push(line);
    else linesByOrg.set(line.organizationId, [line]);
    orgSubtotalUsd.set(
      line.organizationId,
      (orgSubtotalUsd.get(line.organizationId) ?? 0) + line.unitPriceUsd * line.quantity,
    );
  }

  const orgIds = [...linesByOrg.keys()];
  if (orgIds.length === 0) return [];
  const orgs = await prisma.organization.findMany({
    where: { id: { in: orgIds } },
    select: {
      id: true,
      name: true,
      shippingFlatRate: true,
      shippingFlatRateMoney: true,
      shippingFreeThreshold: true,
      shippingFreeThresholdMoney: true,
    },
  });

  return orgs.map((org) => {
    const subtotal = cartSubtotalIn(linesByOrg.get(org.id) ?? [], currency, rates);
    const subtotalUsd = orgSubtotalUsd.get(org.id) ?? 0;

    const flatRateMoney = parseMoney(org.shippingFlatRateMoney, org.shippingFlatRate);
    const flatRate = flatRateMoney ? moneyIn(flatRateMoney, currency, rates) : 0;

    const thresholdMoney =
      org.shippingFreeThreshold != null
        ? parseMoney(org.shippingFreeThresholdMoney, org.shippingFreeThreshold)
        : null;
    const freeThreshold = thresholdMoney ? moneyIn(thresholdMoney, currency, rates) : null;

    // Judged in the buyer's currency, against the amount the seller actually
    // set for it - not against a converted USD figure.
    const free = freeThreshold != null && subtotal >= freeThreshold;
    const charged = free || org.shippingFlatRate === 0;

    return {
      orgId: org.id,
      orgName: org.name,
      currency,
      subtotal,
      flatRate,
      freeThreshold,
      shipping: charged ? 0 : flatRate,
      subtotalUsd,
      flatRateUsd: org.shippingFlatRate,
      freeThresholdUsd: org.shippingFreeThreshold,
      shippingUsd: free ? 0 : org.shippingFlatRate,
      shippingMoney: charged ? null : flatRateMoney,
    };
  });
}

/** Total cart shipping, in the currency the lines were resolved for. */
export function shippingTotal(lines: OrgShippingLine[]): number {
  return lines.reduce((sum, l) => sum + l.shipping, 0);
}

/** The same total as its USD mirror, for records and reporting only. */
export function shippingTotalUsd(lines: OrgShippingLine[]): number {
  return lines.reduce((sum, l) => sum + l.shippingUsd, 0);
}

/** Per-org shipping map (USD base cents), only orgs with a non-zero fee. */
export function shippingByOrgUsd(lines: OrgShippingLine[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const l of lines) if (l.shippingUsd > 0) out[l.orgId] = l.shippingUsd;
  return out;
}
