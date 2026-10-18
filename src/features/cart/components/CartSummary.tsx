"use client";

import { useLocale, useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/currency";
import { useMoney } from "@/lib/useMoney";
import type { OrgShippingLine } from "@/features/shipping/db/shipping";

/**
 * Subtotal, discount, delivery, total - the one breakdown, shared by the
 * drawer, the cart page and checkout.
 *
 * Every amount is already in the buyer's currency: the subtotal is summed from
 * the per-line stored amounts (never one conversion of a USD total, which
 * rounds differently from the prices printed right above it), and the delivery
 * figure comes from the server having applied each seller's rule in that same
 * currency.
 */
export function CartSummary({
  subtotal,
  discount,
  shippingTotal,
  shippingLines,
  className,
}: {
  /** Sum of the lines, in the active currency's minor units. */
  subtotal: number;
  /** Coupon discount in the same units; 0 or null when none is applied. */
  discount?: number | null;
  /** Delivery across every seller, as resolved by the server. */
  shippingTotal: number;
  shippingLines: OrgShippingLine[];
  className?: string;
}) {
  const t = useTranslations("cart");
  const locale = useLocale();
  const { currency } = useMoney();

  const off = discount ?? 0;
  const total = Math.max(0, subtotal - off) + shippingTotal;

  // Did a seller who DOES charge for delivery have the fee waived by their
  // threshold? That is something the buyer just earned, and the progress bar
  // that was telling them about it disappears at the very moment they earn it -
  // so the summary has to say it out loud. A seller with no fee at all earns
  // nothing and says nothing.
  const earnedFreeShipping = shippingLines.some(
    (l) => l.flatRate > 0 && l.freeThreshold != null && l.subtotal >= l.freeThreshold,
  );

  // Nothing to break down - no discount, no fee, nothing earned - so the
  // breakdown would be the same number written three times.
  if (off === 0 && shippingTotal === 0 && !earnedFreeShipping) {
    return (
      <div className={cn("flex justify-between gap-4 font-semibold", className)}>
        <span>{t("total")}</span>
        <span className="shrink-0 tabular-nums">
          {formatPrice(subtotal, currency, locale)}
        </span>
      </div>
    );
  }

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex justify-between gap-4 text-sm text-muted-foreground">
        <span>{t("subtotal")}</span>
        <span className="shrink-0 tabular-nums">
          {formatPrice(subtotal, currency, locale)}
        </span>
      </div>
      {off > 0 && (
        <div className="flex justify-between gap-4 text-sm text-emerald-600">
          <span>{t("discount")}</span>
          <span className="shrink-0 tabular-nums">
            -{formatPrice(off, currency, locale)}
          </span>
        </div>
      )}
      {shippingTotal > 0 ? (
        <div className="flex justify-between gap-4 text-sm text-muted-foreground">
          <span>{t("shipping")}</span>
          <span className="shrink-0 tabular-nums">
            {formatPrice(shippingTotal, currency, locale)}
          </span>
        </div>
      ) : earnedFreeShipping ? (
        <div className="flex justify-between gap-4 text-sm text-emerald-600">
          <span>{t("shipping")}</span>
          <span className="shrink-0">{t("freeShipping")}</span>
        </div>
      ) : null}
      <div className="flex justify-between gap-4 font-semibold pt-1">
        <span>{t("total")}</span>
        <span className="shrink-0 tabular-nums">
          {formatPrice(total, currency, locale)}
        </span>
      </div>
    </div>
  );
}
