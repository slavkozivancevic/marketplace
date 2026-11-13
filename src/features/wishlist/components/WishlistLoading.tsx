"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "@/i18n/navigation";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { SkeletonArray, SkeletonProductGridCard } from "@/components/ui/skeleton";
import { DemoBuyerOnlyPanel } from "@/features/demo/components/DemoBuyerOnlyNotice";
import { useDemoReadOnly } from "@/features/demo/useDemoReadOnly";
import { WISHLIST_IDS_KEY } from "../hooks/useWishlist";
import { WishlistEmptyState } from "./WishlistEmptyState";

const noSubscription = () => () => {};

/** Cards drawn when the count is not known yet (a hard load). */
const DEFAULT_CARDS = 8;

/**
 * The wishlist page while it loads: its header and body. The header's heart
 * button has already fetched the wishlist's ids (`WISHLIST_IDS_KEY`), so on a
 * client-side navigation the count is known - the header says exactly what
 * the page will, an empty wishlist shows the page's empty state and a full one
 * exactly as many cards as it holds. The demo seller and admin get the panel
 * the page shows them.
 *
 * Until hydration is over the cache is not read (the server render cannot
 * have it), so a hard load draws the generic eight cards on both sides.
 */
export function WishlistLoading({
  trail,
  footer,
}: {
  /** The route's breadcrumb trail - static copy, rendered by loading.tsx. */
  trail: ReactNode;
  footer: ReactNode;
}) {
  const t = useTranslations("wishlist");
  const queryClient = useQueryClient();
  const demoReadOnly = useDemoReadOnly();
  const hydrated = useSyncExternalStore(noSubscription, () => true, () => false);
  const ids = hydrated ? queryClient.getQueryData<string[]>(WISHLIST_IDS_KEY) : undefined;
  const count = demoReadOnly ? 0 : ids?.length;

  const header = (
    <div className="shrink-0 px-6 pt-2 sticky-header-bg">
      {trail}
      <PageHeader
        title={t("title")}
        description={
          count
            ? t("savedCount", { count, items: count === 1 ? t("item") : t("items") })
            : t("savedPlaceholder")
        }
      >
        <Button asChild variant="outline">
          <Link href="/products">{t("continueShopping")}</Link>
        </Button>
      </PageHeader>
    </div>
  );

  let body;
  if (demoReadOnly) body = <DemoBuyerOnlyPanel className="py-24" />;
  else if (count === 0) body = <WishlistEmptyState />;
  else
    body = (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        <SkeletonArray amount={count ?? DEFAULT_CARDS}>
          <SkeletonProductGridCard showButton={false} />
        </SkeletonArray>
      </div>
    );

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {header}
      <div className="flex-1 overflow-y-auto min-h-0 flex flex-col">
        <div className="flex-1 px-6 pb-6">{body}</div>
        {footer}
      </div>
    </div>
  );
}
