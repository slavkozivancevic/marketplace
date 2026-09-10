"use client";

import { useCallback } from "react";
import { useLocale } from "next-intl";
import { useCurrencyStore } from "@/store/currency";
import { formatPrice } from "@/lib/currency";
import { moneyIn, parseMoney, type MoneySet } from "@/lib/money";

/**
 * Reads stored money in the currency the user is browsing in.
 *
 * Every price-rendering component used to do the same thing by hand:
 * `formatPrice(convertCents(product.price, currency, currentRate()), currency)`.
 * That is a live conversion on the display path, which is exactly what made a
 * price drift from what the seller saved and shift again whenever the daily
 * rate moved. This hook replaces it with a lookup of the amount stored for the
 * active currency.
 *
 * `mirrorUsd` is only the fallback for rows written before money sets existed;
 * once those are backfilled it is never consulted.
 */
export function useMoney() {
  const { currency, rates } = useCurrencyStore();
  // The reader's language, which decides grouping and decimal marks. Read here
  // rather than at each call site so nothing rendering a price through this hook
  // can forget it.
  const locale = useLocale();

  /** The amount in the active currency, in its minor units. */
  const amount = useCallback(
    (set: unknown, mirrorUsd?: number | null): number => {
      const parsed = set != null || mirrorUsd != null ? parseMoney(set, mirrorUsd) : null;
      return parsed ? moneyIn(parsed, currency, rates) : 0;
    },
    [currency, rates],
  );

  /** The same amount, formatted for the active currency. */
  const format = useCallback(
    (set: unknown, mirrorUsd?: number | null): string =>
      formatPrice(amount(set, mirrorUsd), currency, locale),
    [amount, currency, locale],
  );

  /** For an already-parsed set (props typed as MoneySet rather than Json). */
  const amountOf = useCallback(
    (set: MoneySet | null | undefined): number => (set ? moneyIn(set, currency, rates) : 0),
    [currency, rates],
  );

  const formatOf = useCallback(
    (set: MoneySet | null | undefined): string => formatPrice(amountOf(set), currency, locale),
    [amountOf, currency, locale],
  );

  return { currency, rates, locale, amount, format, amountOf, formatOf };
}
