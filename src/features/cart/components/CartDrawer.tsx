"use client";

import { useTransition } from "react";
import Image from "next/image";
import { Minus, Plus, Trash2, ShoppingCart, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/components/ui/sonner";
import { useCartStore } from "../store/cartStore";
import { createCheckoutSession } from "../actions/checkout";

export function CartDrawer() {
  const { items, isOpen, closeCart, removeItem, updateQuantity, totalPrice } =
    useCartStore();
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleCheckout = () => {
    startTransition(async () => {
      const result = await createCheckoutSession(
        items.map((i) => ({
          productId: i.productId,
          variantId: i.variantId,
          quantity: i.quantity,
        })),
      );

      if ("error" in result) {
        toast.error(result.message);
        return;
      }

      router.push(result.url);
    });
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && closeCart()}>
      <SheetContent className="flex flex-col w-full sm:max-w-md p-6">
        <SheetHeader className="pb-2">
          <SheetTitle>Cart ({items.length})</SheetTitle>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground">
            <ShoppingCart className="h-12 w-12 opacity-30" />
            <p className="text-sm">Your cart is empty</p>
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
                        <Image
                          src={item.productImage}
                          alt={item.productTitle}
                          fill
                          className="object-cover"
                        />
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

                      <div className="flex items-center gap-2 mt-1">
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

            <div className="space-y-4 pt-4 border-t mt-4">
              <div className="flex items-center justify-between font-semibold">
                <span>Total</span>
                <span>${totalPrice().toFixed(2)}</span>
              </div>
              <Button
                className="w-full"
                size="lg"
                onClick={handleCheckout}
                disabled={isPending}
              >
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Redirecting...
                  </>
                ) : (
                  "Checkout"
                )}
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
