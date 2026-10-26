import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { prisma, type TransactionClient } from "@/core/db/prisma";
import { InUseError, NotFoundError } from "@/features/common/errors/domainErrors";
import { assertNotInUse } from "@/features/common/db/assertNotInUse";
import { DEFAULT_LOCALE, NON_DEFAULT_LOCALES } from "@/i18n/config";
import { CacheTags } from "@/lib/cache/tags";
import { captureError } from "@/lib/logger";
import { copyName } from "@/lib/i18n/copyName";
import { PRICE_MARKET_NAME_MAX_LENGTH, type PriceMarketInput } from "../schema/priceMarkets";
import type { PriceMarketConfig, PriceMarketTranslationRow } from "../utils/markets";
import { revalidatePriceMarketCache } from "./cache";

export type PriceMarketListItem = {
  id: string;
  isDefault: boolean;
  translations: PriceMarketTranslationRow[];
  countries: string[];
  /** Rules aimed at the market itself. Country rules do not count: a country
   *  outlives its market and simply falls back into the default one. */
  ruleCount: number;
};

/** Admin list: the default market first, then the rest by creation. */
export async function getAllPriceMarkets(): Promise<PriceMarketListItem[]> {
  const rows = await prisma.priceMarket.findMany({
    orderBy: [{ isDefault: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
    select: {
      id: true,
      isDefault: true,
      translations: { select: { locale: true, name: true } },
      countries: { select: { code: true }, orderBy: { code: "asc" } },
      _count: { select: { rules: true } },
    },
  });
  return rows.map((m) => ({
    id: m.id,
    isDefault: m.isDefault === true,
    translations: m.translations,
    countries: m.countries.map((c) => c.code),
    ruleCount: m._count.rules,
  }));
}

export async function getPriceMarketById(id: string) {
  const market = await prisma.priceMarket.findUnique({
    where: { id },
    select: {
      id: true,
      isDefault: true,
      translations: { select: { locale: true, name: true } },
      countries: { select: { code: true }, orderBy: { code: "asc" } },
    },
  });
  if (!market) return null;
  return {
    ...market,
    isDefault: market.isDefault === true,
    countries: market.countries.map((c) => c.code),
  };
}

/**
 * The market map every price read resolves a viewer against.
 *
 * Cached as one entry for the whole platform and expired by every market
 * write (`revalidatePriceMarketCache`). `countryMovedAt` is the map's change
 * clock per country: every write that moves a country records it (see
 * `recordCountryMoves`), and the row survives the market's delete.
 */
export async function getPriceMarketConfig(): Promise<PriceMarketConfig> {
  "use cache";
  cacheTag(CacheTags.priceMarkets.all());
  cacheLife("max");

  const [markets, moves] = await Promise.all([
    prisma.priceMarket.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        isDefault: true,
        translations: { select: { locale: true, name: true } },
        countries: { select: { code: true }, orderBy: { code: "asc" } },
      },
    }),
    prisma.priceCountryMove.findMany({ select: { code: true, movedAt: true } }),
  ]);
  const fallback = markets.find((m) => m.isDefault === true);
  // The migration creates it and nothing can delete it, so a database without
  // it is a broken deploy or seed. Reported, but NOT thrown: the root layout
  // reads this on every page, and a throw here would take the whole storefront
  // down over a pricing detail. Without a default, unmapped countries simply
  // pay the neutral price - which is the price everyone paid before markets.
  if (!fallback) {
    captureError(new Error("No default price market - the add_price_markets migration seeds one"), {
      source: "getPriceMarketConfig",
    });
  }

  const byCountry: Record<string, string> = {};
  for (const m of markets) for (const c of m.countries) byCountry[c.code] = m.id;

  return {
    defaultId: fallback?.id ?? "",
    byCountry,
    countryMovedAt: Object.fromEntries(moves.map((m) => [m.code, m.movedAt.toISOString()])),
    markets: markets.map((m) => ({
      id: m.id,
      isDefault: m.isDefault === true,
      translations: m.translations,
      countries: m.countries.map((c) => c.code),
    })),
  };
}

/**
 * Per-locale rows from the form shape. The default locale always gets a row;
 * another locale only when it has a name, so a blank row never wins the lookup
 * over the default-locale fallback.
 */
function translationRows(input: PriceMarketInput): PriceMarketTranslationRow[] {
  const rows: PriceMarketTranslationRow[] = [{ locale: DEFAULT_LOCALE, name: input.name.trim() }];
  for (const locale of NON_DEFAULT_LOCALES) {
    const name = input.translations?.[locale]?.name?.trim();
    if (name) rows.push({ locale, name });
  }
  return rows;
}

function nameOf(rows: readonly PriceMarketTranslationRow[]): string {
  return rows.find((t) => t.locale === DEFAULT_LOCALE)?.name ?? rows[0]?.name ?? "";
}

/**
 * Refuses countries another market already owns. The primary key on
 * `PriceMarketCountry.code` would refuse them too, but as a bare unique
 * violation; this names the countries.
 */
async function assertCountriesFree(tx: TransactionClient, countries: string[], ownId: string | null) {
  if (countries.length === 0) return;
  const taken = await tx.priceMarketCountry.findMany({
    where: { code: { in: countries }, ...(ownId ? { marketId: { not: ownId } } : {}) },
    select: { code: true },
    orderBy: { code: "asc" },
  });
  if (taken.length > 0) {
    throw new InUseError({
      key: "priceMarketCountryTaken",
      params: { countries: taken.map((c) => c.code).join(", ") },
    });
  }
}

/**
 * Records that these countries changed market - see `getPriceMarketConfig`.
 * Only their buyers' prices moved with them, so only theirs lose the Omnibus
 * reference for the lookback (see `applyMarket`).
 */
async function recordCountryMoves(tx: TransactionClient, codes: readonly string[]) {
  if (codes.length === 0) return;
  const movedAt = new Date();
  for (const code of codes) {
    await tx.priceCountryMove.upsert({ where: { code }, create: { code, movedAt }, update: { movedAt } });
  }
}

/** Countries in exactly one of the two lists: the ones that changed market. */
function movedBetween(before: readonly string[], after: readonly string[]): string[] {
  return [...before.filter((c) => !after.includes(c)), ...after.filter((c) => !before.includes(c))];
}

export async function createPriceMarket(input: PriceMarketInput) {
  const created = await prisma.$transaction(async (tx) => {
    await assertCountriesFree(tx, input.countries, null);
    const market = await tx.priceMarket.create({
      data: {
        translations: { create: translationRows(input) },
        countries: { create: input.countries.map((code) => ({ code })) },
      },
      select: { id: true },
    });
    await recordCountryMoves(tx, input.countries);
    return market;
  });
  revalidatePriceMarketCache(created.id);
  return { id: created.id, name: input.name.trim() };
}

/**
 * Replaces names and countries. The default market keeps no countries - every
 * unmapped country already falls into it, so listing some there would only
 * make two ways to say the same thing.
 */
export async function updatePriceMarket(id: string, input: PriceMarketInput) {
  await prisma.$transaction(async (tx) => {
    const existing = await tx.priceMarket.findUnique({
      where: { id },
      select: { isDefault: true, countries: { select: { code: true } } },
    });
    if (!existing) throw new NotFoundError(`PriceMarket ${id} not found`);
    const countries = existing.isDefault ? [] : input.countries;
    await assertCountriesFree(tx, countries, id);

    // Replace-all, like tags and trust points: a handful of tiny rows.
    await tx.priceMarketTranslation.deleteMany({ where: { marketId: id } });
    await tx.priceMarketTranslation.createMany({
      data: translationRows(input).map((r) => ({ ...r, marketId: id })),
    });
    const moved = movedBetween(
      existing.countries.map((c) => c.code),
      countries,
    );
    if (moved.length > 0) {
      await tx.priceMarketCountry.deleteMany({ where: { marketId: id } });
      await tx.priceMarketCountry.createMany({ data: countries.map((code) => ({ code, marketId: id })) });
      await recordCountryMoves(tx, moved);
    }
    // A rename moves no country and no price, so it records nothing.
  });
  revalidatePriceMarketCache(id);
  return { name: input.name.trim() };
}

/**
 * A copy of a market: its names, each with its own locale's "Copy of" prefix,
 * and NO countries - a country belongs to exactly one market, so the source
 * keeps them all and the admin picks the copy's own. The copy is always an
 * ordinary market, even when the source is the default one: there is only one
 * default. Nothing moves between markets, so the map's change clock stays put.
 */
export async function duplicatePriceMarket(id: string): Promise<{ id: string; sourceName: string }> {
  const source = await prisma.priceMarket.findUnique({
    where: { id },
    select: { translations: { select: { locale: true, name: true } } },
  });
  if (!source) throw new NotFoundError(`PriceMarket ${id} not found`);

  const copy = await prisma.priceMarket.create({
    data: {
      translations: {
        create: source.translations.map((t) => ({
          locale: t.locale,
          name: copyName(t.locale, t.name, PRICE_MARKET_NAME_MAX_LENGTH),
        })),
      },
    },
    select: { id: true },
  });
  revalidatePriceMarketCache(copy.id);
  return { id: copy.id, sourceName: nameOf(source.translations) };
}

/**
 * Deletes a market. Its countries fall back into the default market (they
 * cascade with it); rules aimed at one of those countries stay valid, because a
 * country rule never stored its market.
 *
 * Refused for the default market, and for a market that rules target: a
 * Restrict FK would refuse the latter too, but as an error nobody can read -
 * the admin list passes the same condition to `blockedReason`.
 */
export async function deletePriceMarket(id: string): Promise<string> {
  const name = await prisma.$transaction(async (tx) => {
    const existing = await tx.priceMarket.findUnique({
      where: { id },
      select: {
        isDefault: true,
        translations: { select: { locale: true, name: true } },
        countries: { select: { code: true } },
        _count: { select: { rules: true } },
      },
    });
    if (!existing) throw new NotFoundError(`PriceMarket ${id} not found`);
    if (existing.isDefault) throw new InUseError({ key: "priceMarketDefault" });
    assertNotInUse([{ count: existing._count.rules, key: "priceMarketInUse" }]);

    await tx.priceMarket.delete({ where: { id } });
    // Its countries fall back into the default market: each of them moved.
    await recordCountryMoves(
      tx,
      existing.countries.map((c) => c.code),
    );
    return nameOf(existing.translations);
  });
  revalidatePriceMarketCache(id);
  return name;
}
