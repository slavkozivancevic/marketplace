"use client";

import { useState, useEffect } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Minus, Plus, Trash2, ShoppingCart, X, Loader2 } from "lucide-react";
import { LoadingImage } from "@/components/ui/LoadingImage";
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
import { useCartStore } from "../store/cartStore";
import { localizedVariantLabel, pickLocalized } from "../utils/variantOptions";
import { useCurrencyStore } from "@/store/currency";
import { formatPrice, convertCents } from "@/lib/currency";

function CartItemImage({ src, alt }: { src: string; alt: string }) {
  return (
    <LoadingImage
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
  const { items, isOpen, closeCart, removeItem, updateQuantity, totalPrice } =
    useCartStore();
  const { currency, currentRate } = useCurrencyStore();
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
                          {formatPrice(convertCents(item.price * item.quantity, currency, currentRate()), currency)}
                        </p>

                        <div className="flex items-center gap-2 mt-1 select-none">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-6 w-6"
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
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 ml-auto text-destructive hover:text-destructive"
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
                  <span>{formatPrice(convertCents(totalPrice(), currency, currentRate()), currency)}</span>
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
