/**
 * Seeds dynamic pricing on a real stage's database (staging Neon): price
 * markets for the admin page, and schedule and market rules on the Proton
 * org's products, so every new screen - the pricing list, the calendar, the
 * admin markets table - and the storefront's strike-through have something to
 * show.
 *
 * Writes go through the app's own db layer (`createRule`), not raw inserts, so
 * windows, Omnibus clocks and the price ledger come out exactly as a seller's
 * save would leave them. Markets are the one exception: `createPriceMarket`
 * invalidates a cache tag, which throws outside Next, so its transaction is
 * repeated here, country moves included.
 *
 * Resolves the stage's DatabaseUrl like scripts/migrate-stage.mjs (direct, not
 * pooled) and sets it BEFORE the app modules load, so it can never fall through
 * to the local .env. Refuses to run unless the Proton org is in that database.
 *
 * Idempotent: a market whose English name exists, or a rule whose name already
 * sits on that product, is skipped.
 *
 * Writes bypass the Server Actions, so no cache tag is invalidated: the stage
 * serves its cached pages until the next deploy starts a fresh cache. The one
 * that bites is the market map (`getPriceMarketConfig`, one platform-wide
 * entry): country rules work at once, but a market rule does not until it is
 * expired. Open any market in the admin and save it unchanged - that expires
 * the entry and moves no country.
 *
 * Usage (from the repo root):
 *   npx tsx --conditions=react-server scripts/staging/dynamic-pricing.ts --stage staging --dump
 *   npx tsx --conditions=react-server scripts/staging/dynamic-pricing.ts --stage staging --apply
 */
import { resolveStageDatabaseUrl } from "../lib/stageDatabaseUrl.mjs";

const ORG_ID = "16e0e989-6988-4117-99e4-9490bfb7e0e2"; // Slavko Zivancevic's Proton Organization
const USER_ID = "cmr8ei89j000002jp0r2jpyzq"; // slavko.zivancevic@protonmail.com
const TZ = "Europe/Belgrade";

type Names = { en: string; sr: string; de: string; es: string };

const MARKETS: { names: Names; countries: string[] }[] = [
  {
    names: { en: "Eurozone", sr: "Evrozona", de: "Eurozone", es: "Eurozona" },
    countries: [
      "AT", "BE", "BG", "CY", "DE", "EE", "ES", "FI", "FR", "GR", "HR",
      "IE", "IT", "LT", "LU", "LV", "MT", "NL", "PT", "SI", "SK",
    ],
  },
  {
    names: { en: "Western Balkans", sr: "Zapadni Balkan", de: "Westbalkan", es: "Balcanes Occidentales" },
    countries: ["AL", "BA", "ME", "MK", "RS"],
  },
  {
    names: { en: "North America", sr: "Severna Amerika", de: "Nordamerika", es: "Norteamérica" },
    countries: ["CA", "US"],
  },
  {
    names: { en: "Nordics", sr: "Nordijske zemlje", de: "Nordische Länder", es: "Países nórdicos" },
    countries: ["DK", "IS", "NO", "SE"],
  },
  {
    names: { en: "UK and Switzerland", sr: "Velika Britanija i Švajcarska", de: "Großbritannien und Schweiz", es: "Reino Unido y Suiza" },
    countries: ["CH", "GB"],
  },
];

type Money = { currency: "usd" | "eur" | "rsd"; amount: number };

type Seed = {
  name: string;
  products: string[];
  /** Variant-level: the product's most expensive variant. */
  topVariant?: boolean;
  adjustment?: "PERCENT" | "FIXED_PRICE" | "AMOUNT_OFF";
  percent?: number;
  money?: Money;
  active?: boolean;
  priority?: number;
} & (
  | {
      kind: "SCHEDULE";
      startsAt: string;
      endsAt: string | null;
      recurrence?: "NONE" | "DAILY" | "WEEKLY" | "MONTHLY";
      startMinute?: number;
      durationMinutes?: number;
      weekdays?: number[];
      monthDay?: number;
    }
  | { kind: "REGION"; market?: string; country?: string }
);

// Belgrade is on CET (+01:00) from 2026-10-25 until 2027-03-28.
const RULES: Seed[] = [
  {
    kind: "SCHEDULE",
    name: "Jesenja akcija",
    percent: -20,
    startsAt: "2026-10-27T00:00:00+01:00",
    endsAt: "2026-11-10T00:00:00+01:00",
    products: ["leather-backpack", "crossbody-bag", "knit-sweater", "trench-coat", "leather-boots", "hiking-backpack-40l"],
  },
  {
    kind: "SCHEDULE",
    name: "Vikend popust",
    percent: -15,
    recurrence: "WEEKLY",
    weekdays: [6, 7],
    startMinute: 0,
    durationMinutes: 1440,
    startsAt: "2026-10-27T00:00:00+01:00",
    endsAt: null,
    products: ["board-game-night", "building-bricks-1000pc", "wooden-train-set", "remote-control-car"],
  },
  {
    kind: "SCHEDULE",
    name: "Happy hour",
    percent: -10,
    recurrence: "DAILY",
    startMinute: 20 * 60,
    durationMinutes: 120,
    startsAt: "2026-10-27T00:00:00+01:00",
    endsAt: null,
    products: ["espresso-machine", "ceramic-dinnerware-set", "non-stick-pan-set"],
  },
  {
    kind: "SCHEDULE",
    name: "Prvi u mesecu",
    percent: -12,
    recurrence: "MONTHLY",
    monthDay: 1,
    startMinute: 0,
    durationMinutes: 1440,
    startsAt: "2026-10-27T00:00:00+01:00",
    endsAt: null,
    products: ["atomic-habits", "clean-architecture", "the-pragmatic-developer", "cooking-basics"],
  },
  {
    kind: "SCHEDULE",
    name: "Black Friday",
    percent: -30,
    priority: 10,
    startsAt: "2026-11-27T00:00:00+01:00",
    endsAt: "2026-12-01T00:00:00+01:00",
    products: ["noise-cancel-earbuds", "wireless-headphones", "4k-smart-tv-55", "oled-tv-65", "ultrabook-pro-14", "galaxy-phone-s"],
  },
  {
    kind: "SCHEDULE",
    name: "Novembarska cena",
    adjustment: "FIXED_PRICE",
    money: { currency: "eur", amount: 29900 },
    startsAt: "2026-10-27T00:00:00+01:00",
    endsAt: "2026-12-01T00:00:00+01:00",
    products: ["gaming-headset"],
  },
  {
    kind: "SCHEDULE",
    name: "Popust 2.000 din",
    adjustment: "AMOUNT_OFF",
    money: { currency: "rsd", amount: 200000 },
    startsAt: "2026-10-27T00:00:00+01:00",
    endsAt: "2026-11-20T00:00:00+01:00",
    products: ["wireless-controller"],
  },
  {
    kind: "SCHEDULE",
    name: "Najveće pakovanje -25%",
    topVariant: true,
    percent: -25,
    startsAt: "2026-10-27T00:00:00+01:00",
    endsAt: "2026-11-15T00:00:00+01:00",
    products: ["eau-de-parfum-noir", "fresh-citrus-cologne"],
  },
  {
    kind: "SCHEDULE",
    name: "Leto 2027 (nacrt)",
    percent: -25,
    active: false,
    startsAt: "2027-06-01T00:00:00+02:00",
    endsAt: "2027-07-01T00:00:00+02:00",
    products: ["summer-dress", "yoga-leggings"],
  },
  {
    kind: "REGION",
    name: "Evrozona +8%",
    market: "Eurozone",
    percent: 8,
    products: ["espresso-machine", "mechanical-keyboard", "studio-over-ear", "bluetooth-speaker"],
  },
  {
    kind: "REGION",
    name: "Zapadni Balkan -10%",
    market: "Western Balkans",
    percent: -10,
    products: ["running-sneakers", "court-sneakers", "classic-cotton-t-shirt", "slim-fit-jeans", "hooded-sweatshirt"],
  },
  {
    kind: "REGION",
    name: "Srbija -15%",
    country: "RS",
    percent: -15,
    products: ["running-sneakers", "stroller-lite"],
  },
  {
    kind: "REGION",
    name: "Nemačka -5%",
    country: "DE",
    percent: -5,
    products: ["running-sneakers", "cordless-drill-18v"],
  },
  {
    kind: "REGION",
    name: "Severna Amerika +5%",
    market: "North America",
    percent: 5,
    products: ["dslr-kit", "mirrorless-camera"],
  },
  {
    kind: "REGION",
    name: "Nordijske zemlje +12%",
    market: "Nordics",
    percent: 12,
    products: ["yoga-mat-pro", "foam-roller"],
  },
  {
    kind: "REGION",
    name: "Ostatak sveta +10%",
    market: "Rest of world",
    percent: 10,
    products: ["oak-coffee-table"],
  },
];

const stageIdx = process.argv.indexOf("--stage");
const stage = stageIdx >= 0 ? process.argv[stageIdx + 1] : undefined;
const apply = process.argv.includes("--apply");
if (!stage || (!apply && !process.argv.includes("--dump"))) {
  console.error("Usage: dynamic-pricing.ts --stage <stage> --dump | --apply");
  process.exit(1);
}

// Before any app module reads it. dotenv (loaded next for the rest of the env)
// never overrides a variable that is already set.
const url = resolveStageDatabaseUrl(stage);
process.env.DATABASE_URL = url;
await import("dotenv/config");

const { prisma } = await import("@/core/db/prisma");
const { createRule } = await import("@/features/pricing/db/priceRules");
const { ensurePricesCurrent } = await import("@/features/pricing/db/roll");
const { getCurrencyRates } = await import("@/features/currency/db/currencyRates");
const { buildMoneySet } = await import("@/lib/money-input");

console.log(`database host: ${new URL(url).host}`);
if (process.env.DATABASE_URL !== url) throw new Error("DATABASE_URL was overridden - refusing to run");
const org = await prisma.organization.findUnique({ where: { id: ORG_ID }, select: { name: true } });
if (!org) throw new Error(`Organization ${ORG_ID} is not in this database - refusing to run`);

async function marketIdsByName(): Promise<Map<string, string>> {
  const rows = await prisma.priceMarketTranslation.findMany({ where: { locale: "en" }, select: { marketId: true, name: true } });
  return new Map(rows.map((r) => [r.name, r.marketId]));
}

async function productBySlug(slug: string) {
  const t = await prisma.productTranslation.findFirst({
    where: { slug, locale: "en", product: { organizationId: ORG_ID, deletedAt: null } },
    select: {
      product: {
        select: { id: true, variants: { select: { id: true, price: true }, orderBy: { price: "desc" }, take: 1 } },
      },
    },
  });
  if (!t) throw new Error(`No product with en slug "${slug}" in the Proton org`);
  return t.product;
}

async function report() {
  const markets = await prisma.priceMarket.findMany({
    select: {
      isDefault: true,
      translations: { where: { locale: "en" }, select: { name: true } },
      countries: { select: { code: true }, orderBy: { code: "asc" } },
    },
  });
  console.log(`\nmarkets: ${markets.length}`);
  for (const m of markets) {
    console.log(`  ${m.translations[0]?.name ?? "?"}${m.isDefault ? " (default)" : ""}: ${m.countries.map((c) => c.code).join(",") || "-"}`);
  }
  const rules = await prisma.priceRule.findMany({
    where: { organizationId: ORG_ID },
    select: { name: true, kind: true, active: true, variantId: true, product: { select: { translations: { where: { locale: "en" }, select: { slug: true } } } } },
    orderBy: [{ kind: "asc" }, { name: "asc" }],
  });
  console.log(`\nrules: ${rules.length}`);
  for (const r of rules) {
    console.log(`  ${r.kind} ${r.name}${r.active ? "" : " (inactive)"}${r.variantId ? " [variant]" : ""} -> ${r.product.translations[0]?.slug}`);
  }
  const onSale = await prisma.product.count({ where: { organizationId: ORG_ID, effectiveRuleId: { not: null } } });
  console.log(`\nproducts priced by a schedule rule right now: ${onSale}`);
}

if (!apply) {
  await report();
  await prisma.$disconnect();
  process.exit(0);
}

// Markets
const existingMarkets = await marketIdsByName();
for (const m of MARKETS) {
  if (existingMarkets.has(m.names.en)) {
    console.log(`market "${m.names.en}" exists - skipped`);
    continue;
  }
  await prisma.$transaction(async (tx) => {
    const taken = await tx.priceMarketCountry.findMany({ where: { code: { in: m.countries } }, select: { code: true } });
    if (taken.length > 0) throw new Error(`"${m.names.en}": ${taken.map((t) => t.code).join(",")} already belong to a market`);
    await tx.priceMarket.create({
      data: {
        translations: { create: (Object.keys(m.names) as (keyof Names)[]).map((locale) => ({ locale, name: m.names[locale] })) },
        countries: { create: m.countries.map((code) => ({ code })) },
      },
    });
    const movedAt = new Date();
    for (const code of m.countries) {
      await tx.priceCountryMove.upsert({ where: { code }, create: { code, movedAt }, update: { movedAt } });
    }
  });
  console.log(`market "${m.names.en}" created (${m.countries.length} countries)`);
}

// Rules
const markets = await marketIdsByName();
const rates = await getCurrencyRates();
let created = 0;
for (const seed of RULES) {
  for (const slug of seed.products) {
    const product = await productBySlug(slug);
    const variantId = seed.topVariant ? (product.variants[0]?.id ?? null) : null;
    if (seed.topVariant && !variantId) throw new Error(`"${slug}" has no variants`);
    const exists = await prisma.priceRule.findFirst({ where: { productId: product.id, name: seed.name }, select: { id: true } });
    if (exists) {
      console.log(`  ${seed.name} -> ${slug}: exists - skipped`);
      continue;
    }
    const adjustment = seed.adjustment ?? "PERCENT";
    const amountMoney = seed.money ? buildMoneySet(seed.money, rates) : null;
    const percentBps = adjustment === "PERCENT" ? Math.round((seed.percent ?? 0) * 100) : null;
    const base = { name: seed.name, variantId, adjustment, percentBps, amountMoney, priority: seed.priority ?? 0, active: seed.active ?? true };
    const write =
      seed.kind === "REGION"
        ? {
            ...base,
            kind: "REGION" as const,
            marketId: seed.market ? (markets.get(seed.market) ?? null) : null,
            countryCode: seed.country ?? null,
            // The fixed neutral schedule of a market rule - see NO_SCHEDULE in ruleMapping.ts.
            startsAt: new Date(0),
            endsAt: null,
            timezone: "UTC",
            recurrence: "NONE" as const,
            startMinute: null,
            durationMinutes: null,
            weekdays: [],
            monthDay: null,
          }
        : {
            ...base,
            kind: "SCHEDULE" as const,
            marketId: null,
            countryCode: null,
            startsAt: new Date(seed.startsAt),
            endsAt: seed.endsAt ? new Date(seed.endsAt) : null,
            timezone: TZ,
            recurrence: seed.recurrence ?? "NONE",
            startMinute: seed.startMinute ?? null,
            durationMinutes: seed.durationMinutes ?? null,
            weekdays: seed.weekdays ?? [],
            monthDay: seed.monthDay ?? null,
          };
    if (seed.kind === "REGION" && seed.market && !write.marketId) throw new Error(`No market "${seed.market}"`);
    await createRule({ organizationId: ORG_ID, productId: product.id, userId: USER_ID, write });
    created++;
    console.log(`  ${seed.name} -> ${slug}${variantId ? " [top variant]" : ""}: created`);
  }
}

// Flip whatever is due now, as the first storefront read would.
await ensurePricesCurrent();
console.log(`\n${created} rule(s) created.`);
await report();
await prisma.$disconnect();
process.exit(0);
