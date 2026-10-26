"use client";

import type { ComponentProps, ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { setRouteShape } from "@/lib/navigation/routeShape";
import { pricingListShapeKey, type PricingListShape } from "./PriceRulesListSkeleton";

/**
 * A button-link to a product's price-rules list that hands the list's view to
 * the list's skeleton on the click, so the skeleton draws that product's rules,
 * notes and calendar instead of a guess. Used wherever the linking page already
 * has the list's data (product details, the rule form).
 */
export function PriceRulesLink({
  href,
  productId,
  shape,
  variant = "outline",
  children,
}: {
  href: ComponentProps<typeof Link>["href"];
  productId: string;
  shape: PricingListShape | null;
  variant?: ComponentProps<typeof Button>["variant"];
  children: ReactNode;
}) {
  return (
    <Button asChild variant={variant}>
      <Link href={href} onClick={() => shape && setRouteShape(pricingListShapeKey(productId), shape)}>
        {children}
      </Link>
    </Button>
  );
}
