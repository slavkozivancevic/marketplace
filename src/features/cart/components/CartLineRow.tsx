"use client";

import { useLocale, useTranslations } from "next-intl";
import { Minus, Plus, Trash2 } from "lucide-react";
import { RetryImage } from "@/components/RetryImage";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useMoney } from "@/lib/useMoney";
import { formatPrice } from "@/lib/currency";
import type { CartItem } from "../store/cartStore";
import { localizedVariantLabel, pickLocalized } from "../utils/variantOptions";

/**
 * One cart line, shared by the drawer, the cart page and the checkout summary.
 *
 * They used to be three hand-written rows, which is how the drawer ended up
 * showing a bare total while checkout showed a breakdown: nothing forced them
 * to agree. The only real difference is whether the buyer can still change the
 * line, so that is the only prop.
 */
export function CartLineRow({
  item,
  editable,
  onQuantityChange,
  onRemove,
}: {
  item: CartItem;
  /** Quantity stepper + remove button. Off on checkout, where the cart is
   *  settled and the line reads as "price x qty". */
  editable: boolean;
  onQuantityChange?: (quantity: number) => void;
  onRemove?: () => void;
}) {
  const t = useTranslations("cart");
  const locale = useLocale();
  const { amount: moneyAmount, currency } = useMoney();

  const title = pickLocalized(item.productTitleI18n, locale, item.productTitle);
  const variantText = localizedVariantLabel(
    item.variantOptions,
    locale,
    item.variantLabel,
  );

  const unit = moneyAmount(item.priceMoney);
  const lineTotal = unit * item.quantity;
  // The "was" price is a per-unit figure like the price beside it, so it is
  // multiplied the same way - striking through a unit price next to a line
  // total would compare two different things.
  const wasUnit = item.compareAtPriceMoney ? moneyAmount(item.compareAtPriceMoney) : null;
  const onSale = wasUnit != null && wasUnit > unit;

  return (
    <div className="flex gap-3 py-1">
      <div
        className={cn(
          "relative shrink-0 overflow-hidden rounded border",
          editable ? "h-16 w-16" : "h-14 w-14",
        )}
      >
        {item.productImage ? (
          <RetryImage
            src={item.productImage}
            alt={title}
            fill
            sizes={editable ? "64px" : "56px"}
            className="object-cover"
          />
        ) : (
          <div className="h-full w-full bg-muted" />
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1 min-w-0">
        <p className="text-sm font-medium truncate">{title}</p>
        {variantText && <p className="text-xs text-muted-foreground">{variantText}</p>}

        {editable ? (
          <>
            {/* `flex-wrap`: the struck-through price sits beside the current
                one, and on a 320px screen - or in a currency whose amounts are
                long, like RSD - the pair can be wider than the column left
                after the 64px thumbnail. Wrapping costs a line; not wrapping
                pushes the row out of the drawer. */}
            <div className="flex flex-wrap items-baseline gap-x-2">
              {onSale && (
                <span className="text-xs text-muted-foreground line-through">
                  {formatPrice(wasUnit! * item.quantity, currency, locale)}
                </span>
              )}
              <span className={cn("text-sm font-semibold", onSale && "text-red-500")}>
                {formatPrice(lineTotal, currency, locale)}
              </span>
            </div>

            <div className="flex items-center gap-2 mt-1 select-none">
              <Button
                variant="outline"
                size="icon"
                className="h-6 w-6"
                // Removing a line is the trash button's job only (same rule as
                // QuantityStepper): stepping down to zero would delete the item
                // from behind a non-destructive control.
                disabled={item.quantity <= 1}
                aria-label={t("decreaseQty")}
                onClick={() => onQuantityChange?.(item.quantity - 1)}
              >
                <Minus className="h-3 w-3" />
              </Button>
              <span className="text-sm w-4 text-center">{item.quantity}</span>
              <Button
                variant="outline"
                size="icon"
                className="h-6 w-6"
                disabled={item.maxStock !== null && item.quantity >= item.maxStock}
                aria-label={t("increaseQty")}
                onClick={() => onQuantityChange?.(item.quantity + 1)}
              >
                <Plus className="h-3 w-3" />
              </Button>
              <Button
                variant="ghostDestructive"
                size="icon"
                className="h-6 w-6 ml-auto"
                aria-label={t("removeItem")}
                onClick={() => onRemove?.()}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">
            {formatPrice(unit, currency, locale)} × {item.quantity}
          </p>
        )}
      </div>

      {!editable && (
        <p className="font-semibold text-sm shrink-0 ml-4">
          {formatPrice(lineTotal, currency, locale)}
        </p>
      )}
    </div>
  );
}
