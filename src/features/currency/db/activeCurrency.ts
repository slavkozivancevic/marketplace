import { cookies } from "next/headers";
import { VALID_CURRENCIES, type Currency } from "@/lib/currency-config";
import type { CurrencyRates } from "@/lib/money";
import { getCurrencyRates } from "./currencyRates";

/**
 * The currency + rates a server action should work in.
 *
 * `rates` is only ever the degraded fallback for a row written without a money
 * set. Anything with a set is read directly, so a stale rate here cannot move a
 * price that a seller already committed to.
 */
export type MoneyContext = {
  currency: Currency;
  rates: CurrencyRates;
};

/**
 * The buyer's currency, from the same `NEXT_CURRENCY` cookie the storefront
 * reads. Read server-side rather than accepted as an argument: it decides what
 * a buyer is charged, so it must not be something a client can assert.
 */
export async function getActiveCurrency(): Promise<Currency> {
  const raw = (await cookies()).get("NEXT_CURRENCY")?.value ?? "usd";
  return VALID_CURRENCIES.includes(raw as Currency) ? (raw as Currency) : "usd";
}

/** The currency plus the rate table, for actions that need both. */
export async function getMoneyContext(): Promise<MoneyContext> {
  const [currency, rates] = await Promise.all([getActiveCurrency(), getCurrencyRates()]);
  return { currency, rates };
}
