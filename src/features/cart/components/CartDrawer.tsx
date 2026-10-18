"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { ShoppingCart, X, Loader2 } from "lucide-react";
import { useRouter, usePathname, Link } from "@/i18n/navigation";
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
import { useCartShipping } from "../hooks/useCartShipping";
import { CartLineRow } from "./CartLineRow";
import { CartSummary } from "./CartSummary";
import { FreeShippingProgress } from "./FreeShippingProgress";
import { SellerLeadTimes } from "./SellerLeadTimes";
import { useMoney } from "@/lib/useMoney";

export function CartDrawer() {
  const t = useTranslations("cart");
  const { items, isOpen, closeCart, removeItem, updateQuantity } = useCartStore();
  // Each line's own snapshotted per-currency amount. The cart total is the sum
  // of those, not a conversion of the USD total - converting once at the end
  // would round differently from the per-line prices shown right above it.
  const { amount: moneyAmount } = useMoney();
  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);
  const router = useRouter();
  const pathname = usePathname();
  const [checkingOut, setCheckingOut] = useState(false);

  // Live prices and per-seller delivery, refreshed whenever the drawer is open
  // and the cart changes. Gated on `isOpen` so a closed drawer is not resolving
  // the cart behind every page in the app.
  const shipping = useCartShipping(isOpen);

  useEffect(() => {
    if (pathname === "/checkout" || pathname === "/cart") {
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

  const subtotal = items.reduce(
    (sum, i) => sum + moneyAmount(i.priceMoney) * i.quantity,
    0,
  );

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
            // Same empty state the /cart page renders, down to the way out: a
            // drawer that only says "empty" is a dead end.
            //
            // It closes itself on click rather than leaning on the pathname
            // effect above, which only fires for /checkout and /cart - and
            // would not fire at all for someone already standing on the
            // product list, where the href changes nothing.
            <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
              <ShoppingCart className="h-12 w-12 text-muted-foreground opacity-30" />
              <div className="space-y-1">
                <p className="font-medium">{t("empty")}</p>
                <p className="text-sm text-muted-foreground">{t("emptyHint")}</p>
              </div>
              <Button asChild>
                <Link href="/products" onClick={closeCart}>
                  {t("continueShopping")}
                </Link>
              </Button>
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto -mx-6 px-6">
                <SellerLeadTimes lines={shipping.lines} className="mb-4" />
                {items.map((item, index) => (
                  <div key={`${item.productId}-${item.variantId}`}>
                    {index > 0 && <Separator className="my-4" />}
                    <CartLineRow
                      item={item}
                      editable
                      onQuantityChange={(q) =>
                        updateQuantity(item.productId, item.variantId, q)
                      }
                      onRemove={() => removeItem(item.productId, item.variantId)}
                    />
                  </div>
                ))}
              </div>

              <div className="space-y-4 pt-4 border-t mt-4 select-none">
                <FreeShippingProgress lines={shipping.lines} />
                {/* No coupon here: the code is entered at checkout, and a
                    discount shown in the drawer that checkout had yet to accept
                    would be a number the buyer has not earned. */}
                <CartSummary
                  subtotal={subtotal}
                  shippingTotal={shipping.total}
                  shippingLines={shipping.lines}
                />
                <div className="space-y-2">
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
                  <Button asChild variant="outline" className="w-full" size="lg">
                    <Link href="/cart">{t("viewCart")}</Link>
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
