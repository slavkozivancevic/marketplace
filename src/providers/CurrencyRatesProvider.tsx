"use client";

import { useEffect } from "react";
import { useCurrencyStore } from "@/store/currency";
import type { CurrencyRates } from "@/store/currency";

/**
 * Server-side: fetch rates via getCurrencyRates(), pass as `rates` prop.
 * This client component seeds the Zustand store so all child components
 * can access up-to-date exchange rates without extra fetches.
 */
export function CurrencyRatesProvider({
  rates,
  children,
}: {
  rates: CurrencyRates;
  children: React.ReactNode;
}) {
  const setRates = useCurrencyStore((s) => s.setRates);

  useEffect(() => {
    setRates(rates);
  }, [rates, setRates]);

  return <>{children}</>;
}