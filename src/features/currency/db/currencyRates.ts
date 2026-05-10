import { prisma } from "@/core/db/prisma";
import type { CurrencyRates } from "@/store/currency";

/**
 * Returns all exchange rates as a plain object { eur: 0.921, rsd: 108.5, ... }.
 * USD is always 1.0 and is not stored in the DB.
 * Safe to call from server components — result is small and fast.
 */
export async function getCurrencyRates(): Promise<CurrencyRates> {
  const rows = await prisma.currencyRate.findMany();
  const rates: CurrencyRates = { usd: 1 };
  for (const row of rows) {
    rates[row.code] = Number(row.rate);
  }
  return rates;
}

/**
 * Returns the rate for a single currency (1.0 for USD).
 * Used at checkout time to snapshot the rate into the order.
 */
export async function getCurrencyRate(code: string): Promise<number> {
  if (code === "usd") return 1;
  const row = await prisma.currencyRate.findUnique({ where: { code } });
  return row ? Number(row.rate) : 1;
}