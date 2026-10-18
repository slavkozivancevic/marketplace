"use client";

import { Link, usePathname } from "@/i18n/navigation";
import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWishlistCount } from "../hooks/useWishlist";

export function WishlistHeaderButton() {
  const count = useWishlistCount();
  // On the wishlist itself the heart marks where the user is instead of
  // linking to the page they are already on: an inert `aria-current="page"`
  // element, which the outline variant styles and strips of hover and press.
  // A `<span>`, not the link, so there is no tab stop and no click either.
  const onPage = usePathname() === "/wishlist";

  return (
    <div className="relative">
      <Button variant="outline" size="icon" asChild>
        {onPage ? (
          <span role="img" aria-label="Wishlist" aria-current="page">
            <Heart className="h-4 w-4" />
          </span>
        ) : (
          <Link href="/wishlist" aria-label="Wishlist">
            <Heart className="h-4 w-4" />
          </Link>
        )}
      </Button>
      {count > 0 && (
        <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground pointer-events-none">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </div>
  );
}