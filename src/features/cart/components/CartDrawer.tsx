"use client";

import { useState, useEffect, useEffectEvent } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Minus, Plus, Trash2, ShoppingCart, X, Loader2 } from "lucide-react";
import { RetryImage } from "@/components/RetryImage";
import { useRouter, usePathname } from "@/i18n/navigation";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useCartStore, type CartItem } from "../store/cartStore";
import { localizedVariantLabel, pickLocalized } from "../utils/variantOptions";
import { applyCartResolution } from "../utils/applyCartResolution";
import { refreshCartAction } from "../actions/refreshCart";
import { toast } from "@/components/ui/sonner";
import { useMoney } from "@/lib/useMoney";
import { formatPrice } from "@/lib/currency";

function CartItemImage({ src, alt }: { src: string; alt: string }) {
  return (
    <RetryImage
      src={src}
      alt={alt}
      fill
      sizes="64px"
      className="object-cover"
    />
  );
}

export function CartDrawer() {
  const t = useTranslations("cart");
  const locale = useLocale();
  const { items, isOpen, closeCart, removeItem, updateQuantity } =
    useCartStore();
  // Each line's own snapshotted per-currency amount. The cart total is the sum
  // of those, not a conversion of the USD total - converting once at the end
  // would round differently from the per-line prices shown right above it.
  const { amount: moneyAmount, currency } = useMoney();
  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);
  const router = useRouter();
  const pathname = usePathname();
  const [checkingOut, setCheckingOut] = useState(false);

  useEffect(() => {
    if (pathname === "/checkout") {
      // Deliberately do NOT reset `checkingOut` here: the sheet's close
      // animation is still playing, and clearing the pending state now makes
      // the button visibly flash back to its idle label mid-animation.
      closeCart();
    }
  }, [pathname, closeCart]);

  // Fresh pending state on every (re)open instead - by then the drawer is
  // closed and no one can see the reset.
  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCheckingOut(false);
    }
  }, [isOpen]);

  // The removal notice reads the translator and the active locale, both new
  // values on every render. As an effect event it stays out of the effect's
  // dependencies, which must be the drawer opening and the cart changing and
  // nothing else, while still seeing the current locale when it fires.
  const notifyRemoved = useEffectEvent((removed: CartItem) => {
    toast.error(
      t("itemRemoved", {
        item: pickLocalized(removed.productTitleI18n, locale, removed.productTitle),
      }),
    );
  });

  // Every price in here is a snapshot taken when the item was added and then
  // persisted to localStorage, so a seller editing the product leaves it
  // behind - and nothing on the client can notice. Re-read the cart from the
  // server each time the drawer opens, and again whenever its contents change
  // while it is open. Without this the drawer quotes one price, checkout -
  // which always re-reads the DB - quotes another, and the buyer is charged
  // the second one. The same pass drops anything no longer purchasable.
  useEffect(() => {
    if (!isOpen || items.length === 0) return;
    let active = true;
    const refs = items.map((i) => ({
      productId: i.productId,
      variantId: i.variantId,
      quantity: i.quantity,
    }));
    refreshCartAction(refs)
      .then((res) => {
        if (!active) return;
        // A price that actually moved replaces the snapshot, which is a new
        // `items` array and so one more pass through here; that pass finds
        // nothing to change and the store hands back the same state, so it
        // settles. An unchanged cart never re-runs at all.
        applyCartResolution(res, (removed) => notifyRemoved(removed));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [isOpen, items]);

  const handleCheckout = () => {
    if (pathname === "/checkout") {
      closeCart();
      return;
    }
    setCheckingOut(true);
    router.push("/checkout");
  };

  return (
    <Sheet
      open={isOpen}
      onOpenChange={(open) => !open && closeCart()}
      modal={false}
    >
      <SheetContent
        className="flex flex-col w-full sm:max-w-md p-0 gap-0"
        aria-describedby={undefined}
        showCloseButton={false}
        onInteractOutside={(e) => {
          if ((e.target as HTMLElement).closest("[data-cart-trigger]"))
            e.preventDefault();
        }}
      >
        <SheetHeader className="shrink-0 border-b px-4 py-3 flex-row items-center gap-2">
          <SheetTitle className="text-sm font-semibold">
            {t("title", { count: totalItems })}
          </SheetTitle>
          <SheetClose asChild className="ml-auto">
            <Button variant="ghost" size="icon-sm">
              <X className="size-4" />
            </Button>
          </SheetClose>
        </SheetHeader>
        <div className="flex flex-col flex-1 overflow-hidden p-6 gap-0">
          {items.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground">
              <ShoppingCart className="h-12 w-12 opacity-30" />
              <p className="text-sm">{t("empty")}</p>
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto -mx-6 px-6">
                {items.map((item, index) => {
                  const variantText = localizedVariantLabel(
                    item.variantOptions,
                    locale,
                    item.variantLabel,
                  );
                  const title = pickLocalized(
                    item.productTitleI18n,
                    locale,
                    item.productTitle,
                  );
                  return (
                  <div key={`${item.productId}-${item.variantId}`}>
                    {index > 0 && <Separator className="my-4" />}
                    <div className="flex gap-3 py-1">
                      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded border">
                        {item.productImage ? (
                          <CartItemImage
                            src={item.productImage}
                            alt={title}
                          />
                        ) : (
                          <div className="h-full w-full bg-muted" />
                        )}
                      </div>

                      <div className="flex flex-1 flex-col gap-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {title}
                        </p>
                        {variantText && (
                          <p className="text-xs text-muted-foreground">
                            {variantText}
                          </p>
                        )}
                        <p className="text-sm font-semibold">
                          {formatPrice(moneyAmount(item.priceMoney, item.price) * item.quantity, currency, locale)}
                        </p>

                        <div className="flex items-center gap-2 mt-1 select-none">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-6 w-6"
                            // Removing a line is the trash button's job only
                            // (same rule as QuantityStepper): stepping down
                            // to zero would delete the item from behind a
                            // non-destructive control.
                            disabled={item.quantity <= 1}
                            aria-label={t("decreaseQty")}
                            onClick={() =>
                              updateQuantity(
                                item.productId,
                                item.variantId,
                                item.quantity - 1,
                              )
                            }
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="text-sm w-4 text-center">
                            {item.quantity}
                          </span>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-6 w-6"
                            disabled={
                              item.maxStock !== null &&
                              item.quantity >= item.maxStock
                            }
                            aria-label={t("increaseQty")}
                            onClick={() =>
                              updateQuantity(
                                item.productId,
                                item.variantId,
                                item.quantity + 1,
                              )
                            }
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghostDestructive"
                            size="icon"
                            className="h-6 w-6 ml-auto"
                            aria-label={t("removeItem")}
                            onClick={() =>
                              removeItem(item.productId, item.variantId)
                            }
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                  );
                })}
              </div>

              <div className="space-y-4 pt-4 border-t mt-4 select-none">
                <div className="flex items-center justify-between font-semibold">
                  <span>{t("total")}</span>
                  <span>
                    {formatPrice(
                      items.reduce(
                        (sum, i) => sum + moneyAmount(i.priceMoney, i.price) * i.quantity,
                        0,
                      ),
                      currency, locale,
                    )}
                  </span>
                </div>
                <Button
                  className="w-full"
                  size="lg"
                  onClick={handleCheckout}
                  disabled={checkingOut}
                >
                  {checkingOut ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t("checkout")}
                    </>
                  ) : (
                    t("checkout")
                  )}
                </Button>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
