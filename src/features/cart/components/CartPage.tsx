"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, ShoppingCart } from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useMoney } from "@/lib/useMoney";
import { useCartStore } from "../store/cartStore";
import { useCartShipping } from "../hooks/useCartShipping";
import { useCartHydrated } from "../hooks/useCartHydrated";
import { CartLineRow } from "./CartLineRow";
import { CartSummary } from "./CartSummary";
import { CartPageSkeleton } from "./CartPageSkeleton";
import { FreeShippingProgress } from "./FreeShippingProgress";
import { SellerLeadTimes } from "./SellerLeadTimes";

/**
 * The cart as a page of its own, beside the drawer rather than instead of it.
 *
 * The drawer is for a glance on the way past; this is where a buyer compares,
 * edits quantities and reads the delivery terms before committing - and it is
 * the thing a cart link in an email or a bookmark can point at. Both are built
 * from the same line, summary and delivery components, so they cannot drift
 * apart: the numbers here are the drawer's numbers are checkout's numbers.
 */
export function CartPage() {
  const t = useTranslations("cart");
  const router = useRouter();
  const { items, removeItem, updateQuantity } = useCartStore();
  const { amount: moneyAmount } = useMoney();
  const shipping = useCartShipping();
  const [checkingOut, setCheckingOut] = useState(false);
  const hydrated = useCartHydrated();

  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);
  const subtotal = items.reduce(
    (sum, i) => sum + moneyAmount(i.priceMoney) * i.quantity,
    0,
  );

  // Until the persisted cart is read back, an empty `items` means "not loaded
  // yet", not "empty" - see `useCartHydrated`. The skeleton is the route's own
  // loading state, so the hand-over to the real cart does not move anything.
  if (!hydrated) return <CartPageSkeleton />;

  if (items.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-16 text-center">
        <ShoppingCart className="h-12 w-12 text-muted-foreground opacity-30" />
        <div className="space-y-1">
          <p className="font-medium">{t("empty")}</p>
          <p className="text-sm text-muted-foreground">{t("emptyHint")}</p>
        </div>
        <Button asChild>
          <Link href="/products">{t("continueShopping")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-6">
      <h1 className="text-2xl font-semibold mb-5">
        {t("title", { count: totalItems })}
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_20rem] gap-6 items-start">
        <div className="space-y-4 min-w-0">
          <FreeShippingProgress lines={shipping.lines} />
          <SellerLeadTimes lines={shipping.lines} />
          <Card>
            <CardContent>
              {items.map((item, index) => (
                <div key={`${item.productId}-${item.variantId}`}>
                  {index > 0 && <Separator className="my-3" />}
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
            </CardContent>
          </Card>
        </div>

        {/* Sticky on desktop so the total stays in view down a long cart; it
            falls back into the flow on narrow screens, under the lines. */}
        <Card className="lg:sticky lg:top-4">
          <CardContent className="space-y-4">
            <CartSummary
              subtotal={subtotal}
              shippingTotal={shipping.total}
              shippingLines={shipping.lines}
            />
            <div className="space-y-2">
              <Button
                className="w-full"
                size="lg"
                disabled={checkingOut}
                onClick={() => {
                  setCheckingOut(true);
                  router.push("/checkout");
                }}
              >
                {checkingOut && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t("checkout")}
              </Button>
              <Button asChild variant="outline" className="w-full" size="lg">
                <Link href="/products">{t("continueShopping")}</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
