import { isWithinReturnWindow, returnDaysLeft } from "./returnWindow";

export type ReturnSellerItemInput = {
  id: string;
  quantity: number;
  title: string;
  variantLabel: string | null;
  organizationId: string;
  orgName: string;
  returnWindowDays: number;
};

export type ReturnSellerPartInput = {
  organizationId: string;
  shippedAt: Date | null;
  deliveredAt: Date | null;
  cancelledAt: Date | null;
};

export type ReturnSeller = {
  organizationId: string;
  name: string;
  shipped: boolean;
  delivered: boolean;
  cancelled: boolean;
  canReturn: boolean;
  returnDaysLeft: number | null;
  windowExpired: boolean;
  items: { orderItemId: string; title: string; variantLabel: string | null; returnable: number }[];
};

/**
 * The buyer order page's per-seller groups: one per seller, in the order their
 * first line appears, with each line's still-returnable quantity. Used by the
 * page (its shipping and returns cards) and by the list's skeleton shape, so the
 * skeleton draws the same rows, buttons and hints.
 *
 * A seller's items become returnable only once paid AND that seller's part is
 * delivered - you return goods you've received, not ones still in transit, and
 * never goods from a seller that withdrew (nothing was ever delivered).
 */
export function groupReturnSellers({
  items,
  parts,
  returnEligible,
  returnedQty,
  now,
}: {
  items: ReturnSellerItemInput[];
  parts: ReturnSellerPartInput[];
  /** Money collected (card captured / COD cash confirmed, not fully refunded). */
  returnEligible: boolean;
  /** orderItemId -> quantity already in a non-rejected return. */
  returnedQty: Record<string, number>;
  now?: Date;
}): ReturnSeller[] {
  const partByOrg = new Map(parts.map((p) => [p.organizationId, p]));
  const groups = new Map<string, ReturnSeller>();
  for (const it of items) {
    let group = groups.get(it.organizationId);
    if (!group) {
      const part = partByOrg.get(it.organizationId);
      const delivered = part?.deliveredAt != null;
      const cancelled = part?.cancelledAt != null;
      // The seller's window, measured from delivery, with `returnWindow.ts`
      // doing the arithmetic for both this button and the server guard. Only
      // meaningful once delivered - before that there is no clock to read, and
      // the delivered check already explains why the button is absent.
      const withinWindow =
        part?.deliveredAt != null && isWithinReturnWindow(part.deliveredAt, it.returnWindowDays, now);
      group = {
        organizationId: it.organizationId,
        name: it.orgName,
        shipped: part?.shippedAt != null,
        delivered,
        cancelled,
        canReturn: returnEligible && delivered && !cancelled && withinWindow,
        returnDaysLeft:
          part?.deliveredAt != null ? returnDaysLeft(part.deliveredAt, it.returnWindowDays, now) : null,
        windowExpired: delivered && !cancelled && !withinWindow,
        items: [],
      };
      groups.set(it.organizationId, group);
    }
    group.items.push({
      orderItemId: it.id,
      title: it.title,
      variantLabel: it.variantLabel,
      returnable: it.quantity - (returnedQty[it.id] ?? 0),
    });
  }
  return [...groups.values()];
}
