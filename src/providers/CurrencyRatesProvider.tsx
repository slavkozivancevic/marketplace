"use client";

import { useEffect } from "react";
import { CurrencyStoreProvider, isValidCurrency } from "@/store/currency";
import type { CurrencyRates } from "@/store/currency";
import type { Currency } from "@/lib/currency-config";

/**
 * Seeds the per-request currency store with the rates and the cookie currency
 * the server read (passed as `initialCurrency`). Because the store is created
 * with that value, SSR renders the correct currency directly - no flash, no
 * hydration mismatch, no localStorage.
 */
export function CurrencyRatesProvider({
  rates,
  initialCurrency,
  children,
}: {
  rates: CurrencyRates;
  initialCurrency?: string;
  children: React.ReactNode;
}) {
  const currency: Currency = isValidCurrency(initialCurrency)
    ? initialCurrency
    : "usd";

  // One-time cleanup of the obsolete localStorage key (currency used to be
  // persisted there). The cookie is the source of truth now.
  useEffect(() => {
    try {
      localStorage.removeItem("marketplace-currency");
    } catch {
      // ignore
    }
  }, []);

  return (
    <CurrencyStoreProvider initialCurrency={currency} rates={rates}>
      {children}
    </CurrencyStoreProvider>
  );
}
