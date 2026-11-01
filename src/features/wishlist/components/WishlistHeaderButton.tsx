"use client";

import { Link, usePathname } from "@/i18n/navigation";
import { Heart } from "lucide-react";
import { useTranslations } from "next-intl";
import { IconButton } from "@/components/IconButton";
import { useWishlistCount } from "../hooks/useWishlist";
import { useDemoReadOnly } from "@/features/demo/useDemoReadOnly";

export function WishlistHeaderButton() {
  const t = useTranslations("wishlist");
  const count = useWishlistCount();
  // On the wishlist itself the heart marks where the user is instead of
  // linking to the page they are already on: an inert `aria-current="page"`
  // element, which the outline variant styles and strips of hover and press.
  // A `<span>`, not the link, so there is no tab stop and no click either.
  const onPage = usePathname() === "/wishlist";
  // Hearts set before the account went view-only are not a wishlist anyone
  // here owns; the page explains instead of listing them.
  const demoReadOnly = useDemoReadOnly();

  return (
    <div className="relative">
      <IconButton label={t("label")} variant="outline" asChild>
        {onPage ? (
          <span role="img" aria-current="page">
            <Heart className="h-4 w-4" />
          </span>
        ) : (
          <Link href="/wishlist">
            <Heart className="h-4 w-4" />
          </Link>
        )}
      </IconButton>
      {count > 0 && !demoReadOnly && (
        <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground pointer-events-none">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </div>
  );
}