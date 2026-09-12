-- The money contract, written into the schema.
--
-- Until now every `*Money` column was nullable and every read passed the Int
-- mirror alongside it, so `parseMoney` could rebuild a USD-only set when the
-- Json was missing. That net existed for rows written before sets did. Those
-- rows are gone (backfilled by 20260906120000, verified on staging after a
-- full production-shaped cycle), so the guarantee moves into the database and
-- the net is removed from the code.
--
-- TWO PARTS, IN THIS ORDER:
--
-- 1. SELF-HEAL. Every money column is repaired where an amount exists without
--    a set - all eleven, not just the four being tightened. A row that arrived
--    after the backfill (a restored dump, a hand-written INSERT, a seed) is
--    fixed here rather than failing the deploy. And a nullable column matters
--    just as much now: with the fallback gone, `compareAtPrice` without
--    `compareAtPriceMoney` would stop rendering its crossed-out price instead
--    of quietly falling back.
--
-- 2. SET NOT NULL, but only where the MIRROR is already NOT NULL. The
--    invariant is "a set exists whenever the amount exists", so an optional
--    amount keeps an optional set: compareAtPrice, costPrice,
--    shippingFreeThreshold and minOrder stay nullable, and `Coupon.valueMoney`
--    stays nullable because a PERCENT coupon has no money value at all.
--
-- THE MATH IS INLINED, not imported, for the same reason as the backfill
-- migration: replaying history on a fresh database years from now has to
-- produce these same rows. It mirrors deriveMinor()/roundDerived() in
-- src/lib/money.ts as of today:
--
--   eur = round(usdCents * eurRate)     -- derivedStep 1
--   rsd = round(usdCents * rsdRate)     -- derivedStep 1
--
-- Note the difference from 20260906120000, which wrote `round(x * rsd / 100)
-- * 100`: RSD's derivedStep was a whole dinar then and is a para now. That
-- change was applied to existing rows by `db:backfill-money --rederive`; this
-- file starts from the current rule so a freshly repaired row agrees with what
-- the application would write today.
--
-- A currency with no CurrencyRate row is left out of `amounts` rather than
-- guessed at - the same degraded-but-honest shape the backfill used. USD is
-- always present, so the column is never left NULL.

CREATE VIEW _notnull_rates AS
SELECT
  COALESCE(MAX(CASE WHEN code = 'eur' THEN rate END), 0) AS eur,
  COALESCE(MAX(CASE WHEN code = 'rsd' THEN rate END), 0) AS rsd
FROM "CurrencyRate";

-- 1. SELF-HEAL: an amount without a set gets one.

UPDATE "Organization" t SET "shippingFlatRateMoney" = jsonb_build_object(
  'primary', 'usd',
  'authored', jsonb_build_array('usd'),
  'amounts', jsonb_build_object('usd', t."shippingFlatRate")
    || CASE WHEN r.eur > 0 THEN jsonb_build_object('eur', round(t."shippingFlatRate" * r.eur)::bigint) ELSE '{}'::jsonb END
    || CASE WHEN r.rsd > 0 THEN jsonb_build_object('rsd', round(t."shippingFlatRate" * r.rsd)::bigint) ELSE '{}'::jsonb END,
  'rates', jsonb_build_object('usd', 1)
    || CASE WHEN r.eur > 0 THEN jsonb_build_object('eur', r.eur) ELSE '{}'::jsonb END
    || CASE WHEN r.rsd > 0 THEN jsonb_build_object('rsd', r.rsd) ELSE '{}'::jsonb END
)
FROM _notnull_rates r
WHERE t."shippingFlatRateMoney" IS NULL AND t."shippingFlatRate" IS NOT NULL;

UPDATE "Organization" t SET "shippingFreeThresholdMoney" = jsonb_build_object(
  'primary', 'usd',
  'authored', jsonb_build_array('usd'),
  'amounts', jsonb_build_object('usd', t."shippingFreeThreshold")
    || CASE WHEN r.eur > 0 THEN jsonb_build_object('eur', round(t."shippingFreeThreshold" * r.eur)::bigint) ELSE '{}'::jsonb END
    || CASE WHEN r.rsd > 0 THEN jsonb_build_object('rsd', round(t."shippingFreeThreshold" * r.rsd)::bigint) ELSE '{}'::jsonb END,
  'rates', jsonb_build_object('usd', 1)
    || CASE WHEN r.eur > 0 THEN jsonb_build_object('eur', r.eur) ELSE '{}'::jsonb END
    || CASE WHEN r.rsd > 0 THEN jsonb_build_object('rsd', r.rsd) ELSE '{}'::jsonb END
)
FROM _notnull_rates r
WHERE t."shippingFreeThresholdMoney" IS NULL AND t."shippingFreeThreshold" IS NOT NULL;

UPDATE "Product" t SET "priceMoney" = jsonb_build_object(
  'primary', 'usd',
  'authored', jsonb_build_array('usd'),
  'amounts', jsonb_build_object('usd', t."price")
    || CASE WHEN r.eur > 0 THEN jsonb_build_object('eur', round(t."price" * r.eur)::bigint) ELSE '{}'::jsonb END
    || CASE WHEN r.rsd > 0 THEN jsonb_build_object('rsd', round(t."price" * r.rsd)::bigint) ELSE '{}'::jsonb END,
  'rates', jsonb_build_object('usd', 1)
    || CASE WHEN r.eur > 0 THEN jsonb_build_object('eur', r.eur) ELSE '{}'::jsonb END
    || CASE WHEN r.rsd > 0 THEN jsonb_build_object('rsd', r.rsd) ELSE '{}'::jsonb END
)
FROM _notnull_rates r
WHERE t."priceMoney" IS NULL AND t."price" IS NOT NULL;

UPDATE "Product" t SET "compareAtPriceMoney" = jsonb_build_object(
  'primary', 'usd',
  'authored', jsonb_build_array('usd'),
  'amounts', jsonb_build_object('usd', t."compareAtPrice")
    || CASE WHEN r.eur > 0 THEN jsonb_build_object('eur', round(t."compareAtPrice" * r.eur)::bigint) ELSE '{}'::jsonb END
    || CASE WHEN r.rsd > 0 THEN jsonb_build_object('rsd', round(t."compareAtPrice" * r.rsd)::bigint) ELSE '{}'::jsonb END,
  'rates', jsonb_build_object('usd', 1)
    || CASE WHEN r.eur > 0 THEN jsonb_build_object('eur', r.eur) ELSE '{}'::jsonb END
    || CASE WHEN r.rsd > 0 THEN jsonb_build_object('rsd', r.rsd) ELSE '{}'::jsonb END
)
FROM _notnull_rates r
WHERE t."compareAtPriceMoney" IS NULL AND t."compareAtPrice" IS NOT NULL;

UPDATE "Product" t SET "costPriceMoney" = jsonb_build_object(
  'primary', 'usd',
  'authored', jsonb_build_array('usd'),
  'amounts', jsonb_build_object('usd', t."costPrice")
    || CASE WHEN r.eur > 0 THEN jsonb_build_object('eur', round(t."costPrice" * r.eur)::bigint) ELSE '{}'::jsonb END
    || CASE WHEN r.rsd > 0 THEN jsonb_build_object('rsd', round(t."costPrice" * r.rsd)::bigint) ELSE '{}'::jsonb END,
  'rates', jsonb_build_object('usd', 1)
    || CASE WHEN r.eur > 0 THEN jsonb_build_object('eur', r.eur) ELSE '{}'::jsonb END
    || CASE WHEN r.rsd > 0 THEN jsonb_build_object('rsd', r.rsd) ELSE '{}'::jsonb END
)
FROM _notnull_rates r
WHERE t."costPriceMoney" IS NULL AND t."costPrice" IS NOT NULL;

UPDATE "ProductVariant" t SET "priceMoney" = jsonb_build_object(
  'primary', 'usd',
  'authored', jsonb_build_array('usd'),
  'amounts', jsonb_build_object('usd', t."price")
    || CASE WHEN r.eur > 0 THEN jsonb_build_object('eur', round(t."price" * r.eur)::bigint) ELSE '{}'::jsonb END
    || CASE WHEN r.rsd > 0 THEN jsonb_build_object('rsd', round(t."price" * r.rsd)::bigint) ELSE '{}'::jsonb END,
  'rates', jsonb_build_object('usd', 1)
    || CASE WHEN r.eur > 0 THEN jsonb_build_object('eur', r.eur) ELSE '{}'::jsonb END
    || CASE WHEN r.rsd > 0 THEN jsonb_build_object('rsd', r.rsd) ELSE '{}'::jsonb END
)
FROM _notnull_rates r
WHERE t."priceMoney" IS NULL AND t."price" IS NOT NULL;

UPDATE "ProductVariant" t SET "compareAtPriceMoney" = jsonb_build_object(
  'primary', 'usd',
  'authored', jsonb_build_array('usd'),
  'amounts', jsonb_build_object('usd', t."compareAtPrice")
    || CASE WHEN r.eur > 0 THEN jsonb_build_object('eur', round(t."compareAtPrice" * r.eur)::bigint) ELSE '{}'::jsonb END
    || CASE WHEN r.rsd > 0 THEN jsonb_build_object('rsd', round(t."compareAtPrice" * r.rsd)::bigint) ELSE '{}'::jsonb END,
  'rates', jsonb_build_object('usd', 1)
    || CASE WHEN r.eur > 0 THEN jsonb_build_object('eur', r.eur) ELSE '{}'::jsonb END
    || CASE WHEN r.rsd > 0 THEN jsonb_build_object('rsd', r.rsd) ELSE '{}'::jsonb END
)
FROM _notnull_rates r
WHERE t."compareAtPriceMoney" IS NULL AND t."compareAtPrice" IS NOT NULL;

UPDATE "ProductVariant" t SET "costPriceMoney" = jsonb_build_object(
  'primary', 'usd',
  'authored', jsonb_build_array('usd'),
  'amounts', jsonb_build_object('usd', t."costPrice")
    || CASE WHEN r.eur > 0 THEN jsonb_build_object('eur', round(t."costPrice" * r.eur)::bigint) ELSE '{}'::jsonb END
    || CASE WHEN r.rsd > 0 THEN jsonb_build_object('rsd', round(t."costPrice" * r.rsd)::bigint) ELSE '{}'::jsonb END,
  'rates', jsonb_build_object('usd', 1)
    || CASE WHEN r.eur > 0 THEN jsonb_build_object('eur', r.eur) ELSE '{}'::jsonb END
    || CASE WHEN r.rsd > 0 THEN jsonb_build_object('rsd', r.rsd) ELSE '{}'::jsonb END
)
FROM _notnull_rates r
WHERE t."costPriceMoney" IS NULL AND t."costPrice" IS NOT NULL;

UPDATE "ProductHistory" t SET "priceMoney" = jsonb_build_object(
  'primary', 'usd',
  'authored', jsonb_build_array('usd'),
  'amounts', jsonb_build_object('usd', t."price")
    || CASE WHEN r.eur > 0 THEN jsonb_build_object('eur', round(t."price" * r.eur)::bigint) ELSE '{}'::jsonb END
    || CASE WHEN r.rsd > 0 THEN jsonb_build_object('rsd', round(t."price" * r.rsd)::bigint) ELSE '{}'::jsonb END,
  'rates', jsonb_build_object('usd', 1)
    || CASE WHEN r.eur > 0 THEN jsonb_build_object('eur', r.eur) ELSE '{}'::jsonb END
    || CASE WHEN r.rsd > 0 THEN jsonb_build_object('rsd', r.rsd) ELSE '{}'::jsonb END
)
FROM _notnull_rates r
WHERE t."priceMoney" IS NULL AND t."price" IS NOT NULL;

UPDATE "Coupon" t SET "valueMoney" = jsonb_build_object(
  'primary', 'usd',
  'authored', jsonb_build_array('usd'),
  'amounts', jsonb_build_object('usd', t."value")
    || CASE WHEN r.eur > 0 THEN jsonb_build_object('eur', round(t."value" * r.eur)::bigint) ELSE '{}'::jsonb END
    || CASE WHEN r.rsd > 0 THEN jsonb_build_object('rsd', round(t."value" * r.rsd)::bigint) ELSE '{}'::jsonb END,
  'rates', jsonb_build_object('usd', 1)
    || CASE WHEN r.eur > 0 THEN jsonb_build_object('eur', r.eur) ELSE '{}'::jsonb END
    || CASE WHEN r.rsd > 0 THEN jsonb_build_object('rsd', r.rsd) ELSE '{}'::jsonb END
)
FROM _notnull_rates r
WHERE t."valueMoney" IS NULL AND t."value" IS NOT NULL AND t."type" = 'FIXED';

UPDATE "Coupon" t SET "minOrderMoney" = jsonb_build_object(
  'primary', 'usd',
  'authored', jsonb_build_array('usd'),
  'amounts', jsonb_build_object('usd', t."minOrder")
    || CASE WHEN r.eur > 0 THEN jsonb_build_object('eur', round(t."minOrder" * r.eur)::bigint) ELSE '{}'::jsonb END
    || CASE WHEN r.rsd > 0 THEN jsonb_build_object('rsd', round(t."minOrder" * r.rsd)::bigint) ELSE '{}'::jsonb END,
  'rates', jsonb_build_object('usd', 1)
    || CASE WHEN r.eur > 0 THEN jsonb_build_object('eur', r.eur) ELSE '{}'::jsonb END
    || CASE WHEN r.rsd > 0 THEN jsonb_build_object('rsd', r.rsd) ELSE '{}'::jsonb END
)
FROM _notnull_rates r
WHERE t."minOrderMoney" IS NULL AND t."minOrder" IS NOT NULL;

DROP VIEW _notnull_rates;

-- 2. THE CONTRACT. Only the columns whose Int mirror is itself NOT NULL.
ALTER TABLE "Organization" ALTER COLUMN "shippingFlatRateMoney" SET NOT NULL;
ALTER TABLE "Product" ALTER COLUMN "priceMoney" SET NOT NULL;
ALTER TABLE "ProductHistory" ALTER COLUMN "priceMoney" SET NOT NULL;
ALTER TABLE "ProductVariant" ALTER COLUMN "priceMoney" SET NOT NULL;
