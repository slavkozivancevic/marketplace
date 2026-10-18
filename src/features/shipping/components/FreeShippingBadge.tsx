"use client";

import { useTranslations } from "next-intl";
import { Truck } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMoney } from "@/lib/useMoney";
import type { MoneySet } from "@/lib/money";

/**
 * "Free delivery", where the seller actually offers it.
 *
 * Two shapes for two jobs. On a CARD it is a flat claim, so it renders only
 * when delivery is free with no minimum to reach - a conditional "free over
 * 15.000" on a tile in a grid is a promise the tile cannot keep, and twenty of
 * them turn a product grid into fine print. On a PRODUCT PAGE there is room to
 * qualify it, so the threshold is spelled out with its amount.
 *
 * The amount is printed from the seller's stored MoneySet, never by converting
 * the USD mirror: this is the figure the buyer's cart will be judged against,
 * and the two have to be the same number.
 */
export function FreeShippingBadge({
  freeAlways,
  freeThresholdMoney,
  variant,
  className,
}: {
  freeAlways: boolean;
  freeThresholdMoney: MoneySet | null;
  /** "badge" = pill on a card (unconditional only). "line" = full sentence. */
  variant: "badge" | "line";
  className?: string;
}) {
  const t = useTranslations("products");
  const { formatOf } = useMoney();

  if (variant === "badge") {
    if (!freeAlways) return null;
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5",
          "text-[11px] font-medium text-emerald-700",
          "dark:bg-emerald-950/60 dark:text-emerald-400",
          className,
        )}
      >
        <Truck className="h-3 w-3" />
        {t("freeDelivery")}
      </span>
    );
  }

  // A threshold of 0 would read as "free over nothing"; that is just free.
  const threshold =
    freeThresholdMoney && !freeAlways ? formatOf(freeThresholdMoney) : null;
  if (!freeAlways && !threshold) return null;

  return (
    <p className={cn("flex items-center gap-1.5 text-sm", className)}>
      <Truck className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span>
        {freeAlways ? t("freeDelivery") : t("freeDeliveryOver", { amount: threshold! })}
      </span>
    </p>
  );
}
