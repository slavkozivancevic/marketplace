"use client";

import { useLocale, useTranslations } from "next-intl";
import { Truck } from "lucide-react";
import { formatPrice } from "@/lib/currency";
import { useMoney } from "@/lib/useMoney";
import type { OrgShippingLine } from "@/features/shipping/db/shipping";

/**
 * How far this cart is from free delivery, per seller.
 *
 * PER SELLER, not one bar for the cart. The threshold belongs to the
 * organization - "free over 15.000 RSD with THIS seller" - so a single bar over
 * the cart total would promise free delivery the moment the sum crossed a line
 * no one seller had reached. With one seller the bar carries no name, because
 * there is nothing to disambiguate; with several, each says whose it is.
 *
 * Every amount arrives already resolved in the buyer's currency by
 * `shippingLinesForResolved`, judged against the amount the seller actually
 * typed. The gap shown here is therefore exactly what flips delivery to free,
 * never a converted figure that lands a dinar short.
 */
export function FreeShippingProgress({
  lines,
  className,
}: {
  lines: OrgShippingLine[];
  className?: string;
}) {
  const t = useTranslations("cart");
  const locale = useLocale();
  const { currency } = useMoney();

  // A seller is worth a bar only while free delivery is still something to
  // reach: there has to be a threshold, a fee to waive, and a gap left.
  const pending = lines.filter(
    (l) =>
      l.freeThreshold != null && l.freeThreshold > 0 && l.shipping > 0 && l.subtotal < l.freeThreshold,
  );
  if (pending.length === 0) return null;

  const multi = lines.length > 1;

  return (
    <div className={className}>
      {pending.map((l) => {
        const remaining = l.freeThreshold! - l.subtotal;
        const pct = Math.min(100, Math.round((l.subtotal / l.freeThreshold!) * 100));
        return (
          <div key={l.orgId} className="space-y-1.5">
            <p className="flex items-start gap-1.5 text-xs">
              <Truck className="h-3.5 w-3.5 shrink-0 text-muted-foreground mt-px" />
              <span>
                {multi
                  ? t("freeShippingNudge", {
                      amount: formatPrice(remaining, currency, locale),
                      seller: l.orgName,
                    })
                  : t.rich("freeShippingRemaining", {
                      amount: formatPrice(remaining, currency, locale),
                      b: (chunks) => <span className="font-semibold">{chunks}</span>,
                    })}
              </span>
            </p>
            <div className="flex items-center gap-2">
              {/* Plain divs, not <progress>: this is decoration beside a
                  sentence that already states the number, so it carries
                  aria-hidden rather than a second, redundant announcement. */}
              <div
                aria-hidden
                className="h-1.5 flex-1 min-w-0 overflow-hidden rounded-full bg-muted"
              >
                <div
                  className="h-full rounded-full bg-foreground transition-[width] duration-300"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">
                {formatPrice(l.freeThreshold!, currency, locale)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
