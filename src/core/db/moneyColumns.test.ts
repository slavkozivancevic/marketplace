import { describe, it, expect } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import { moneyCol, optionalMoneyCol, partialPriceColumns, priceColumns } from "./moneyColumns";
import { authorMoney, type CurrencyRates } from "@/lib/money";

const RATES: CurrencyRates = { usd: 1, eur: 0.921, rsd: 108.5 };
const rsd = (amount: number) => authorMoney(amount, "rsd", RATES);

describe("moneyCol", () => {
  it("pairs the USD mirror with the serialized set", () => {
    const { mirror, json } = moneyCol(rsd(100005));
    expect(mirror).toBe(922);
    expect(json.primary).toBe("rsd");
    expect(json.amounts.rsd).toBe(100005);
  });
});

describe("optionalMoneyCol", () => {
  it("clears both columns for a null value", () => {
    const { mirror, json } = optionalMoneyCol(null);
    expect(mirror).toBeNull();
    // DbNull, not a plain null: plain null writes a JSON `null` VALUE into the
    // column where it is accepted at all, which would then parse as a set that
    // exists but is empty.
    expect(json).toBe(Prisma.DbNull);
  });

  it("treats undefined the same as null", () => {
    expect(optionalMoneyCol(undefined).json).toBe(Prisma.DbNull);
  });
});

describe("priceColumns", () => {
  it("writes all three pairs, clearing the ones not supplied", () => {
    const cols = priceColumns({ price: rsd(100005) });
    expect(cols.price).toBe(922);
    expect(cols.priceMoney).toMatchObject({ primary: "rsd" });
    expect(cols.compareAtPrice).toBeNull();
    expect(cols.compareAtPriceMoney).toBe(Prisma.DbNull);
    expect(cols.costPrice).toBeNull();
    expect(cols.costPriceMoney).toBe(Prisma.DbNull);
  });

  it("never lets a mirror disagree with its set", () => {
    const cols = priceColumns({ price: rsd(100005), compareAtPrice: rsd(129900) });
    expect(cols.price).toBe(922);
    expect(cols.compareAtPrice).toBe(1197);
  });
});

describe("partialPriceColumns", () => {
  it("touches only the fields present in the input", () => {
    const cols = partialPriceColumns({ price: rsd(100005) });
    expect(Object.keys(cols).sort()).toEqual(["price", "priceMoney"]);
  });

  it("emits nothing at all when nothing was supplied", () => {
    expect(partialPriceColumns({})).toEqual({});
  });

  it("clears a field explicitly set to null", () => {
    const cols = partialPriceColumns({ compareAtPrice: null });
    expect(cols.compareAtPrice).toBeNull();
    expect(cols.compareAtPriceMoney).toBe(Prisma.DbNull);
  });

  it("distinguishes an omitted field from one cleared to null", () => {
    expect("costPrice" in partialPriceColumns({ price: rsd(100) })).toBe(false);
    expect("costPrice" in partialPriceColumns({ costPrice: null })).toBe(true);
  });
});
