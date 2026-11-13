"use client";

import { Heart } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";

/** The wishlist with nothing in it - the page's, and its loading state's when the count is known to be 0. */
export function WishlistEmptyState() {
  const t = useTranslations("wishlist");
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted">
        <Heart className="h-10 w-10 text-muted-foreground" />
      </div>
      <h2 className="text-xl font-semibold">{t("empty")}</h2>
      <p className="text-muted-foreground max-w-sm">{t("emptyDesc")}</p>
      <Button asChild>
        <Link href="/products">{t("browseProducts")}</Link>
      </Button>
    </div>
  );
}
