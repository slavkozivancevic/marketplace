"use client";

import { Minus, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Safety ceiling for untracked stock (maxStock null = unlimited) so the
// stepper can't be cranked into absurd quantities.
const UNLIMITED_CAP = 99;

interface QuantityStepperProps {
  value: number;
  onChange: (value: number) => void;
  /** Max selectable quantity; null = untracked stock (capped internally). */
  max: number | null;
  disabled?: boolean;
  /** Matches the height of the sibling Add to Cart button. */
  size?: "default" | "sm";
  className?: string;
}

/** Compact − / count / + control used next to Add to Cart buttons (product
 *  page + quick view). Same idiom as the cart drawer's inline stepper. */
export function QuantityStepper({
  value,
  onChange,
  max,
  disabled = false,
  size = "default",
  className,
}: QuantityStepperProps) {
  const t = useTranslations("cart");
  const cap = max === null ? UNLIMITED_CAP : Math.min(max, UNLIMITED_CAP);
  const btnSize = size === "sm" ? "h-8 w-8" : "h-9 w-9";

  return (
    <div
      className={cn("flex items-center gap-1.5 select-none", className)}
      role="group"
      aria-label={t("quantity")}
    >
      <Button
        type="button"
        variant="outline"
        size="icon"
        className={btnSize}
        disabled={disabled || value <= 1}
        aria-label={t("decreaseQty")}
        onClick={() => onChange(Math.max(1, value - 1))}
      >
        <Minus className="h-3.5 w-3.5" />
      </Button>
      <span
        className={cn(
          "text-center tabular-nums font-medium",
          size === "sm" ? "w-6 text-sm" : "w-7 text-sm",
        )}
        aria-live="polite"
      >
        {value}
      </span>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className={btnSize}
        disabled={disabled || value >= cap}
        aria-label={t("increaseQty")}
        onClick={() => onChange(Math.min(cap, value + 1))}
      >
        <Plus className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
