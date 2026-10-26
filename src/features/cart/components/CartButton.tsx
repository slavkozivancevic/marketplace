"use client";

import { useSyncExternalStore } from "react";
import { ShoppingCart } from "lucide-react";
import { useTranslations } from "next-intl";
import { IconButton } from "@/components/IconButton";
import { usePathname } from "@/i18n/navigation";
import { useCartStore } from "../store/cartStore";

export function CartButton() {
  const t = useTranslations("cart");
  const isOpen = useCartStore((s) => s.isOpen);
  const openCart = useCartStore((s) => s.openCart);
  const closeCart = useCartStore((s) => s.closeCart);

  const count = useSyncExternalStore(
    useCartStore.subscribe,
    () => useCartStore.getState().totalItems(),
    () => 0,
  );
  // On the cart page the icon marks where the user is instead of opening a
  // drawer with the same cart over it: an inert `aria-current="page"`
  // element, which the outline variant styles and strips of hover and press.
  // A `<span>`, not a button, so there is no tab stop and no click either.
  // Checkout keeps the live button - the drawer is a real shortcut there.
  const onPage = usePathname() === "/cart";

  return (
    <div className="relative">
      {onPage ? (
        <IconButton label={t("label")} variant="outline" asChild>
          <span role="img" aria-current="page">
            <ShoppingCart className="h-4 w-4" />
          </span>
        </IconButton>
      ) : (
        <IconButton label={t("label")} variant="outline" data-cart-trigger onClick={isOpen ? closeCart : openCart}>
          <ShoppingCart className="h-4 w-4" />
        </IconButton>
      )}
      {count > 0 && (
        <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground pointer-events-none">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </div>
  );
}
