"use client";

import { createStore, useStore } from "zustand";
import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { VALID_CURRENCIES, type Currency } from "@/lib/currency-config";

export const isValidCurrency = (c: unknown): c is Currency =>
  typeof c === "string" && (VALID_CURRENCIES as readonly string[]).includes(c);

/** rates[code] = how many units of that currency per 1 USD */
export type CurrencyRates = Record<string, number>;

export interface CurrencyState {
  currency: Currency;
  /** Exchange rates loaded from the server. */
  rates: CurrencyRates;
  setCurrency: (currency: Currency) => void;
  setRates: (rates: CurrencyRates) => void;
  /** Rate for the current currency (1.0 for USD). */
  currentRate: () => number;
}

type CurrencyStoreApi = ReturnType<typeof createCurrencyStore>;

function createCurrencyStore(initialCurrency: Currency) {
  return createStore<CurrencyState>((set, get) => ({
    currency: initialCurrency,
    rates: {},
    setCurrency: (currency) => {
      if (isValidCurrency(currency)) set({ currency });
    },
    setRates: (rates) => set({ rates }),
    currentRate: () => {
      const { currency, rates } = get();
      return currency === "usd" ? 1 : (rates[currency] ?? 1);
    },
  }));
}

const CurrencyStoreContext = createContext<CurrencyStoreApi | null>(null);

/**
 * Module ref to the single client store instance, for non-React reads (e.g. the
 * list fetchers that need the current rate at fetch time). Set on the client
 * only - the server never runs those fetchers.
 */
let clientStoreApi: CurrencyStoreApi | null = null;

/**
 * Creates the currency store seeded with the cookie value the server read, so
 * SSR and the client's first render both use the right currency (no flash, no
 * hydration mismatch). The store is per-provider-instance (per request on the
 * server), so concurrent users with different currencies never collide.
 */
export function CurrencyStoreProvider({
  initialCurrency,
  rates,
  children,
}: {
  initialCurrency: Currency;
  rates: CurrencyRates;
  children: ReactNode;
}) {
  // Create the store once per provider instance. useState's lazy initializer
  // runs exactly once and yields a stable reference, without reading a ref
  // during render (which the React Compiler lint rules forbid).
  const [store] = useState(() => {
    const s = createCurrencyStore(initialCurrency);
    s.getState().setRates(rates);
    return s;
  });

  // Expose the client instance for the non-React getCurrentRate() helper.
  // Done in an effect (not during render) so the module global is only
  // mutated as a committed side effect, never while rendering.
  useEffect(() => {
    clientStoreApi = store;
    return () => {
      if (clientStoreApi === store) clientStoreApi = null;
    };
  }, [store]);

  // Keep rates fresh if the server prop changes (e.g. revalidation).
  useEffect(() => {
    store.getState().setRates(rates);
  }, [rates, store]);

  return createElement(
    CurrencyStoreContext.Provider,
    { value: store },
    children,
  );
}

export function useCurrencyStore(): CurrencyState;
export function useCurrencyStore<T>(selector: (state: CurrencyState) => T): T;
export function useCurrencyStore<T>(selector?: (state: CurrencyState) => T) {
  const store = useContext(CurrencyStoreContext);
  if (!store) {
    throw new Error("useCurrencyStore must be used within CurrencyStoreProvider");
  }
  return useStore(store, selector ?? ((s) => s as unknown as T));
}

/** Non-reactive read of the current exchange rate (for fetchers / sort
 *  callbacks outside React). Falls back to 1 before the store is ready. */
export function getCurrentRate(): number {
  return clientStoreApi?.getState().currentRate() ?? 1;
}
