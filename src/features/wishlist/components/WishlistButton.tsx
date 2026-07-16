"use client";

import { useEffect, useState } from "react";
import { Heart } from "lucide-react";
import { useClerk, useAuth } from "@clerk/nextjs";
import { useLocale } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { useIsWishlisted, useWishlistToggle } from "../hooks/useWishlist";

interface WishlistButtonProps {
  productId: string;
  className?: string;
  size?: number;
}

export function WishlistButton({
  productId,
  className,
  size = 18,
}: WishlistButtonProps) {
  const { isSignedIn } = useAuth();
  const { openSignIn } = useClerk();
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const wishlisted = useIsWishlisted(productId);
  const { mutate, isPending } = useWishlistToggle();

  // SSR HTML always renders the neutral (unwishlisted) heart - the server has
  // no per-user query cache. Under streaming/selective hydration this subtree
  // can hydrate AFTER the header already fetched the wishlist ids, so the
  // first client render would say "wishlisted" while the server HTML says
  // otherwise. React does NOT patch attribute mismatches ("won't be patched
  // up"), leaving the DOM heart inverted vs React state - clicks then do the
  // opposite of what the user sees. Gating on mounted makes the first client
  // render always match the server; the real state paints right after mount.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);
  const isWishlisted = mounted && wishlisted;

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    if (!isSignedIn) {
      // Land back on the same-locale home so middleware doesn't have to
      // resolve `/` -> `/<locale>` again after Clerk closes the modal.
      openSignIn({ fallbackRedirectUrl: `/${locale}` });
      return;
    }

    mutate(productId, {
      onSuccess: () => {
        // The wishlist page's grid is server-rendered from the wishlist
        // itself, so a removed product would linger until the next full
        // navigation - refresh the route so the card actually disappears.
        if (pathname === "/wishlist") router.refresh();
      },
    });
  }

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      aria-label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
      className={cn(
        "flex items-center justify-center rounded-full w-8 h-8 transition-all duration-200 cursor-pointer",
        "bg-background/85 backdrop-blur-xs border border-border/60 shadow-sm",
        "hover:scale-110 hover:border-rose-400/60",
        isWishlisted && "border-rose-400/60",
        className,
      )}
    >
      <Heart
        style={{ width: size, height: size }}
        className={cn(
          "transition-all duration-200",
          isWishlisted
            ? "fill-rose-500 stroke-rose-500"
            : "fill-transparent stroke-muted-foreground",
          "hover:stroke-rose-400",
        )}
      />
    </button>
  );
}
