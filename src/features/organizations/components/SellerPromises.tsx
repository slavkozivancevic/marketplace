"use client";

import { useTranslations } from "next-intl";
import { RotateCcw, Truck } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MoneySet } from "@/lib/money";
import { FreeShippingBadge } from "@/features/shipping/components/FreeShippingBadge";

/**
 * The two promises a seller publishes about an order, as stored on their
 * organization row.
 *
 * Carried as a small value object rather than the whole org: every surface that
 * shows these (product page, quick view, cart) needs exactly these three
 * numbers, and nothing should be tempted to render a seller's internal settings
 * next to a buy button.
 */
export type SellerPolicy = {
  /** Working days, both set or both null. Null = this seller promises nothing
   *  about delivery time, and the line is omitted entirely. */
  leadTimeMinDays: number | null;
  leadTimeMaxDays: number | null;
  /** Calendar days from delivery. 0 is a real answer: no returns. */
  returnWindowDays: number;
  /** Delivery is free with no minimum. */
  freeShippingAlways: boolean;
  /** Minimum for free delivery; null = never free. */
  freeShippingThresholdMoney: MoneySet | null;
};

/**
 * Delivery estimate and return window, as two quiet trust lines.
 *
 * Both numbers are the seller's own and both are load-bearing elsewhere: the
 * return window is what `createReturn` measures its deadline against. Nothing
 * here invents a value - a seller with no delivery estimate simply gets one
 * line instead of two.
 */
export function SellerPromises({
  policy,
  className,
}: {
  policy: SellerPolicy;
  className?: string;
}) {
  const t = useTranslations("products");
  const { leadTimeMinDays: min, leadTimeMaxDays: max, returnWindowDays } = policy;

  // Both or neither - the schema writes them together, so a half-set pair would
  // be a row somebody edited by hand. Treated as "no promise" rather than
  // rendered as an open-ended range.
  const leadTime =
    min != null && max != null
      ? min === max
        ? t("deliveryEstimateExact", { count: min })
        : t("deliveryEstimate", { min, max })
      : null;

  return (
    <div className={cn("space-y-1.5", className)}>
      {/* Delivery cost first, then how long it takes, then how long they have
          to change their mind - the order a buyer asks them in. */}
      <FreeShippingBadge
        freeAlways={policy.freeShippingAlways}
        freeThresholdMoney={policy.freeShippingThresholdMoney}
        variant="line"
      />
      {leadTime && (
        <p className="flex items-center gap-1.5 text-sm">
          <Truck className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span>{leadTime}</span>
        </p>
      )}
      <p className="flex items-center gap-1.5 text-sm">
        <RotateCcw className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span>
          {returnWindowDays > 0
            ? t("returnWindowValue", { count: returnWindowDays })
            : t("returnWindowNone")}
        </span>
      </p>
    </div>
  );
}
