import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Currency } from "@/lib/currency-config";

/** rates[code] = how many units of that currency per 1 USD */
export type CurrencyRates = Record<string, number>;

interface CurrencyStore {
  currency: Currency;
  /** Exchange rates loaded from the server (seeded on app start). */
  rates: CurrencyRates;
  setCurrency: (currency: Currency) => void;
  setRates: (rates: CurrencyRates) => void;
  /** Returns the rate for the current currency (1.0 for USD). */
  currentRate: () => number;
}

export const useCurrencyStore = create<CurrencyStore>()(
  persist(
    (set, get) => ({
      currency: "usd",
      rates: {},
      setCurrency: (currency) => set({ currency }),
      setRates: (rates) => set({ rates }),
      currentRate: () => {
        const { currency, rates } = get();
        if (currency === "usd") return 1;
        return rates[currency] ?? 1;
      },
    }),
    {
      name: "marketplace-currency",
      // Only persist the selected currency - rates are always reloaded from server
      partialize: (state) => ({ currency: state.currency }),
    },
  ),
);