"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { Minus, Plus, Trash2, ShoppingCart, X } from "lucide-react";
import { useRouter } from "next/navigation";
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

function CartItemImage({ src, alt }: { src: string; alt: string }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <>
      {!loaded && <div className="absolute inset-0 z-10 skeleton-shimmer" />}
      <Image src={src} alt={alt} fill className="object-cover" onLoad={() => setLoaded(true)} />
    </>
  );
}

export function CartDrawer() {
  const t = useTranslations("cart");
  const { items, isOpen, closeCart, removeItem, updateQuantity, totalPrice } =
    useCartStore();
  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);
  const router = useRouter();

  const handleCheckout = () => {
    closeCart();
    router.push("/checkout");
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && closeCart()} modal={false}>
      <SheetContent
        className="flex flex-col w-full sm:max-w-md p-0 gap-0"
        showCloseButton={false}
        onInteractOutside={(e) => {
          if ((e.target as HTMLElement).closest("[data-cart-trigger]")) e.preventDefault();
        }}
      >
        <SheetHeader className="shrink-0 border-b px-4 py-3 flex-row items-center gap-2">
          <SheetTitle className="text-sm font-semibold">{t("title", { count: totalItems })}</SheetTitle>
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
              {items.map((item, index) => (
                <div key={`${item.productId}-${item.variantId}`}>
                  {index > 0 && <Separator className="my-4" />}
                  <div className="flex gap-3 py-1">
                    <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded border">
                      {item.productImage ? (
                        <CartItemImage src={item.productImage} alt={item.productTitle} />
                      ) : (
                        <div className="h-full w-full bg-muted" />
                      )}
                    </div>

                    <div className="flex flex-1 flex-col gap-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {item.productTitle}
                      </p>
                      {item.variantLabel && (
                        <p className="text-xs text-muted-foreground">
                          {item.variantLabel}
                        </p>
                      )}
                      <p className="text-sm font-semibold">
                        ${(item.price * item.quantity).toFixed(2)}
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
              ))}
            </div>

            <div className="space-y-4 pt-4 border-t mt-4 select-none">
              <div className="flex items-center justify-between font-semibold">
                <span>{t("total")}</span>
                <span>${totalPrice().toFixed(2)}</span>
              </div>
              <Button
                className="w-full"
                size="lg"
                onClick={handleCheckout}
              >
                {t("checkout")}
              </Button>
            </div>
          </>
        )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
