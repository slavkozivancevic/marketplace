import { prisma } from "@/core/db/prisma";
import { resolveCart, type CartItemRef, type ResolvedCartLine } from "@/features/cart/db/resolveCart";

/** Cart line reference - prices are always read from the DB, never the client. */
export type ShippingCartItem = CartItemRef;

/** Per-seller delivery line for one cart: the org's rule, its subtotal, and the
 *  resulting shipping fee. All money in USD base cents (converted to the order
 *  currency by the caller). */
export type OrgShippingLine = {
  orgId: string;
  orgName: string;
  subtotalUsd: number;
  flatRateUsd: number;
  freeThresholdUsd: number | null;
  /** Charged shipping for this seller (0 when free / flat rate is 0). */
  shippingUsd: number;
};

/**
 * Resolves the per-seller delivery for a cart. Items are grouped by owning
 * organization; each org charges its `shippingFlatRate`, waived once that org's
 * subtotal reaches `shippingFreeThreshold` (null threshold = never free). The
 * fee is the seller's - no platform fee, and coupons never touch it.
 */
export async function cartShippingLines(items: ShippingCartItem[]): Promise<OrgShippingLine[]> {
  const { lines } = await resolveCart(items);
  return shippingLinesForResolved(lines);
}

/**
 * Per-seller delivery for an already-resolved cart. Lets callers that have
 * already run {@link resolveCart} (e.g. to also read `unavailable`) avoid a
 * second resolution pass.
 */
export async function shippingLinesForResolved(
  resolved: ResolvedCartLine[],
): Promise<OrgShippingLine[]> {
  if (resolved.length === 0) return [];

  // Subtotal per owning org.
  const orgSubtotal = new Map<string, number>();
  for (const line of resolved) {
    orgSubtotal.set(
      line.organizationId,
      (orgSubtotal.get(line.organizationId) ?? 0) + line.unitPriceUsd * line.quantity,
    );
  }

  const orgIds = [...orgSubtotal.keys()];
  if (orgIds.length === 0) return [];
  const orgs = await prisma.organization.findMany({
    where: { id: { in: orgIds } },
    select: { id: true, name: true, shippingFlatRate: true, shippingFreeThreshold: true },
  });

  return orgs.map((org) => {
    const subtotalUsd = orgSubtotal.get(org.id) ?? 0;
    const free = org.shippingFreeThreshold != null && subtotalUsd >= org.shippingFreeThreshold;
    return {
      orgId: org.id,
      orgName: org.name,
      subtotalUsd,
      flatRateUsd: org.shippingFlatRate,
      freeThresholdUsd: org.shippingFreeThreshold,
      shippingUsd: free ? 0 : org.shippingFlatRate,
    };
  });
}

/** Total cart shipping (USD base cents). */
export function shippingTotalUsd(lines: OrgShippingLine[]): number {
  return lines.reduce((sum, l) => sum + l.shippingUsd, 0);
}

/** Per-org shipping map (USD base cents), only orgs with a non-zero fee. */
export function shippingByOrgUsd(lines: OrgShippingLine[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const l of lines) if (l.shippingUsd > 0) out[l.orgId] = l.shippingUsd;
  return out;
}
