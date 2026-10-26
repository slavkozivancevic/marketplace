import type { PricingScope } from "./PriceRulesScreens";
import { PriceRulesListSkeleton } from "./PriceRulesListSkeleton";

/**
 * Route skeleton for the price-rules list page. The body is client-side: it
 * draws the list the linking page handed over (see PriceRulesLink).
 */
export function PriceRulesLoading({ scope }: { scope: PricingScope }) {
  return <PriceRulesListSkeleton scope={scope} />;
}
