export type Currency = "usd" | "eur" | "rsd";

export const VALID_CURRENCIES = ["usd", "eur", "rsd"] as const satisfies readonly Currency[];