import { z } from "zod";
import { VALID_CURRENCIES, type Currency } from "@/lib/currency-config";
import {
  authorMoney,
  setAuthoredAmount,
  type CurrencyRates,
  type MoneySet,
} from "@/lib/money";

/**
 * What a form sends to the server for one money value.
 *
 * Two deliberate choices:
 *
 * - `amount` is an INTEGER in `currency`'s minor unit, not a decimal. A float
 *   crossing the wire is how a typed 1000.05 became 1000.0499999 and then a
 *   different stored number; there is nothing to round here because there are
 *   no fractions left to lose.
 * - No rates come from the client. The server builds the `MoneySet` with rates
 *   it reads itself, so a stale or tampered client rate cannot decide what a
 *   product costs.
 */
export const moneyInputSchema = z.object({
  currency: z.enum(VALID_CURRENCIES),
  amount: z.number().int(),
  /** Per-currency "fixed price for this market" pins, in each key's minor
   *  units. The primary currency is ignored here - it comes from `amount`. */
  overrides: z.partialRecord(z.enum(VALID_CURRENCIES), z.number().int()).optional(),
});

export type MoneyInput = z.infer<typeof moneyInputSchema>;

/** A money input that must be a real, positive amount (a price, a fee). */
export const positiveMoneyInputSchema = moneyInputSchema.extend({
  amount: z.number().int().positive(),
});

/** A money input that may legitimately be zero (a free-shipping flat rate). */
export const nonNegativeMoneyInputSchema = moneyInputSchema.extend({
  amount: z.number().int().min(0),
});

/**
 * Turns what the form sent into the set that gets stored. Server-side only -
 * `rates` must come from the database, never from the request.
 *
 * @throws MissingRateError (from authorMoney) when the typed currency has no
 *   rate, so the caller fails the save instead of storing a wrong USD mirror.
 */
export function buildMoneySet(input: MoneyInput, rates: CurrencyRates): MoneySet {
  let set = authorMoney(input.amount, input.currency, rates);
  for (const [code, amount] of Object.entries(input.overrides ?? {})) {
    const currency = code as Currency;
    if (currency === input.currency || amount == null) continue;
    set = setAuthoredAmount(set, currency, amount, rates);
  }
  return set;
}

/**
 * Keeps the stored set when a save did not actually change the price.
 *
 * `buildMoneySet` re-derives every non-authored currency at whatever the rate is
 * NOW, and update paths call it unconditionally. So fixing a typo in a product's
 * description re-prices that product in every other currency: the seller changed
 * a word, and buyers in Germany pay something else. The authored amount never
 * moves, so the damage is a rounding step, but a price moving with nobody
 * touching it is the exact failure this module exists to prevent.
 *
 * Compares the two sets by their AUTHORING - what a human actually chose - via
 * `sameMoneyInput`, the same predicate `MoneyField` uses to decide whether the
 * form is dirty. One definition of unchanged on both sides of the wire, instead
 * of two that can drift apart. Taking two sets rather than the form input is
 * what lets it sit wherever a built set meets a stored one, including deep in
 * `syncVariants` where the original input is long gone.
 *
 * A stored set MISSING a currency is deliberately not preserved: it was written
 * while that rate was unavailable, and keeping it would leave the hole there for
 * good. Rebuilding heals it now that a rate exists.
 */
export function preserveDerived(
  built: MoneySet,
  stored: MoneySet | null | undefined,
): MoneySet {
  if (
    stored &&
    VALID_CURRENCIES.every((c) => stored.amounts[c] != null) &&
    sameMoneyInput(toMoneyInput(built), toMoneyInput(stored))
  ) {
    return stored;
  }
  return built;
}

/**
 * The inverse, for seeding a form from a stored set: the value as it was
 * authored, in the currency it was entered in, carrying any per-currency pins.
 *
 * This is the ONLY seed a form should use. Which currency the seller happens to
 * be looking at is a display concern and lives inside `MoneyField`, never in
 * the form value - otherwise merely having the header on another currency makes
 * the form look edited, and saving an unrelated field silently moves which
 * currency the price is exact in.
 */
export function toMoneyInput(set: MoneySet): MoneyInput {
  const overrides: Partial<Record<Currency, number>> = {};
  for (const currency of set.authored) {
    if (currency === set.primary) continue;
    const amount = set.amounts[currency];
    if (amount != null) overrides[currency] = amount;
  }
  return {
    currency: set.primary,
    amount: set.amounts[set.primary] ?? 0,
    ...(Object.keys(overrides).length > 0 ? { overrides } : {}),
  };
}

/** A blank input, opened in whatever currency the screen is already showing. */
export function emptyMoneyInput(currency: Currency): MoneyInput {
  return { currency, amount: 0 };
}

/**
 * Whether two inputs describe the same authoring - same currency, same amount,
 * same pins.
 *
 * `MoneyField` uses it against `toMoneyInput(stored)` to tell "the user has not
 * touched this yet" from "the user has re-authored it". That distinction is
 * what keeps merely LOOKING at a price in another currency from counting as an
 * edit, and from rewriting which currency the stored value is exact in.
 *
 * Compared field by field over `VALID_CURRENCIES` rather than by stringifying:
 * two equal inputs can serialize differently depending on the order their pins
 * were added.
 */
export function sameMoneyInput(a: MoneyInput, b: MoneyInput): boolean {
  if (a.currency !== b.currency || a.amount !== b.amount) return false;
  const ao = a.overrides ?? {};
  const bo = b.overrides ?? {};
  return VALID_CURRENCIES.every((c) => (ao[c] ?? null) === (bo[c] ?? null));
}

/**
 * Pins one currency to an exact amount, as a "fixed price for this market".
 */
export function withOverride(
  input: MoneyInput,
  currency: Currency,
  amount: number,
): MoneyInput {
  return { ...input, overrides: { ...(input.overrides ?? {}), [currency]: amount } };
}

/**
 * Removes a pin.
 *
 * Rebuilt field by field rather than spreading, so that when the last pin goes
 * the `overrides` key is REMOVED and not left as `undefined`. Form libraries
 * compare a value against its defaults key by key, and an extra key holding
 * undefined is not equal to no key at all - which left a form flagged as edited
 * after a user pinned a currency and then undid it, with nothing different.
 */
export function withoutOverride(input: MoneyInput, currency: Currency): MoneyInput {
  const remaining = { ...(input.overrides ?? {}) };
  delete remaining[currency];
  const base: MoneyInput = { currency: input.currency, amount: input.amount };
  return Object.keys(remaining).length > 0 ? { ...base, overrides: remaining } : base;
}
