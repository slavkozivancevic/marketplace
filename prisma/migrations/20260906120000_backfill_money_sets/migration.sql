-- Data migration: materialize a MoneySet onto every money column that has only
-- its USD-cent mirror.
--
-- WHY THIS IS A MIGRATION AND NOT A DEPLOY STEP
-- A row with no set falls back to deriving its other currencies at read time,
-- at whatever today's rate happens to be - the exact exchange-rate drift the
-- money layer exists to remove. So it must run, exactly once, in a recorded
-- order relative to the schema change. That is what `_prisma_migrations` is
-- for. A standing step in buildspec.yml would instead re-run on every deploy
-- and block it behind a long UPDATE.
--
-- WHY THE MATH IS INLINED HERE RATHER THAN CALLING authorMoney()
-- A data migration must stay reproducible: replaying history on a fresh
-- database years from now has to produce the same rows. Importing application
-- code would break that the moment someone changes a rounding rule. The rule
-- as of this migration is frozen below on purpose, and mirrors
-- deriveMinor()/roundDerived() in src/lib/money.ts at this point in time:
--
--   eur = round(usdCents * eurRate)                 -- derivedStep 1 (a cent)
--   rsd = round(usdCents * rsdRate / 100) * 100     -- derivedStep 100 (a dinar)
--
-- Those two formulas are pinned by tests in src/lib/money.test.ts, so changing
-- a derivedStep fails there instead of silently diverging from these rows.
--
-- Postgres `round(numeric)` rounds half away from zero and JS `Math.round`
-- rounds half up; every amount here is non-negative, so they agree.
--
-- The expression is written out per column rather than wrapped in a helper
-- function on purpose: no dollar-quoted function bodies, so there is nothing
-- for a migration runner to mis-split. Verbose beats clever in a file that
-- touches every price in the database.
--
-- Existing rows were all authored in USD - that was the only option before this
-- feature - so each becomes a USD-primary set. A currency with no CurrencyRate
-- row is left out of `amounts` entirely rather than guessed at; `moneyIn` then
-- falls back for that one currency only.

CREATE VIEW _backfill_rates AS
SELECT
  COALESCE(MAX(CASE WHEN code = 'eur' THEN rate END), 0) AS eur,
  COALESCE(MAX(CASE WHEN code = 'rsd' THEN rate END), 0) AS rsd
FROM "CurrencyRate";

-- Product
UPDATE "Product" p SET
  "priceMoney" = CASE WHEN p."priceMoney" IS NULL THEN jsonb_build_object(
    'primary', 'usd',
    'authored', jsonb_build_array('usd'),
    'amounts', jsonb_build_object('usd', p."price")
      || CASE WHEN r.eur > 0 THEN jsonb_build_object('eur', round(p."price" * r.eur)::bigint) ELSE '{}'::jsonb END
      || CASE WHEN r.rsd > 0 THEN jsonb_build_object('rsd', (round(p."price" * r.rsd / 100) * 100)::bigint) ELSE '{}'::jsonb END,
    'rates', jsonb_build_object('usd', 1)
      || CASE WHEN r.eur > 0 THEN jsonb_build_object('eur', r.eur) ELSE '{}'::jsonb END
      || CASE WHEN r.rsd > 0 THEN jsonb_build_object('rsd', r.rsd) ELSE '{}'::jsonb END
  ) ELSE p."priceMoney" END,
  "compareAtPriceMoney" = CASE WHEN p."compareAtPriceMoney" IS NULL AND p."compareAtPrice" IS NOT NULL THEN jsonb_build_object(
    'primary', 'usd',
    'authored', jsonb_build_array('usd'),
    'amounts', jsonb_build_object('usd', p."compareAtPrice")
      || CASE WHEN r.eur > 0 THEN jsonb_build_object('eur', round(p."compareAtPrice" * r.eur)::bigint) ELSE '{}'::jsonb END
      || CASE WHEN r.rsd > 0 THEN jsonb_build_object('rsd', (round(p."compareAtPrice" * r.rsd / 100) * 100)::bigint) ELSE '{}'::jsonb END,
    'rates', jsonb_build_object('usd', 1)
      || CASE WHEN r.eur > 0 THEN jsonb_build_object('eur', r.eur) ELSE '{}'::jsonb END
      || CASE WHEN r.rsd > 0 THEN jsonb_build_object('rsd', r.rsd) ELSE '{}'::jsonb END
  ) ELSE p."compareAtPriceMoney" END,
  "costPriceMoney" = CASE WHEN p."costPriceMoney" IS NULL AND p."costPrice" IS NOT NULL THEN jsonb_build_object(
    'primary', 'usd',
    'authored', jsonb_build_array('usd'),
    'amounts', jsonb_build_object('usd', p."costPrice")
      || CASE WHEN r.eur > 0 THEN jsonb_build_object('eur', round(p."costPrice" * r.eur)::bigint) ELSE '{}'::jsonb END
      || CASE WHEN r.rsd > 0 THEN jsonb_build_object('rsd', (round(p."costPrice" * r.rsd / 100) * 100)::bigint) ELSE '{}'::jsonb END,
    'rates', jsonb_build_object('usd', 1)
      || CASE WHEN r.eur > 0 THEN jsonb_build_object('eur', r.eur) ELSE '{}'::jsonb END
      || CASE WHEN r.rsd > 0 THEN jsonb_build_object('rsd', r.rsd) ELSE '{}'::jsonb END
  ) ELSE p."costPriceMoney" END
FROM _backfill_rates r
WHERE p."priceMoney" IS NULL
   OR (p."compareAtPriceMoney" IS NULL AND p."compareAtPrice" IS NOT NULL)
   OR (p."costPriceMoney" IS NULL AND p."costPrice" IS NOT NULL);

-- ProductVariant
UPDATE "ProductVariant" v SET
  "priceMoney" = CASE WHEN v."priceMoney" IS NULL THEN jsonb_build_object(
    'primary', 'usd',
    'authored', jsonb_build_array('usd'),
    'amounts', jsonb_build_object('usd', v."price")
      || CASE WHEN r.eur > 0 THEN jsonb_build_object('eur', round(v."price" * r.eur)::bigint) ELSE '{}'::jsonb END
      || CASE WHEN r.rsd > 0 THEN jsonb_build_object('rsd', (round(v."price" * r.rsd / 100) * 100)::bigint) ELSE '{}'::jsonb END,
    'rates', jsonb_build_object('usd', 1)
      || CASE WHEN r.eur > 0 THEN jsonb_build_object('eur', r.eur) ELSE '{}'::jsonb END
      || CASE WHEN r.rsd > 0 THEN jsonb_build_object('rsd', r.rsd) ELSE '{}'::jsonb END
  ) ELSE v."priceMoney" END,
  "compareAtPriceMoney" = CASE WHEN v."compareAtPriceMoney" IS NULL AND v."compareAtPrice" IS NOT NULL THEN jsonb_build_object(
    'primary', 'usd',
    'authored', jsonb_build_array('usd'),
    'amounts', jsonb_build_object('usd', v."compareAtPrice")
      || CASE WHEN r.eur > 0 THEN jsonb_build_object('eur', round(v."compareAtPrice" * r.eur)::bigint) ELSE '{}'::jsonb END
      || CASE WHEN r.rsd > 0 THEN jsonb_build_object('rsd', (round(v."compareAtPrice" * r.rsd / 100) * 100)::bigint) ELSE '{}'::jsonb END,
    'rates', jsonb_build_object('usd', 1)
      || CASE WHEN r.eur > 0 THEN jsonb_build_object('eur', r.eur) ELSE '{}'::jsonb END
      || CASE WHEN r.rsd > 0 THEN jsonb_build_object('rsd', r.rsd) ELSE '{}'::jsonb END
  ) ELSE v."compareAtPriceMoney" END,
  "costPriceMoney" = CASE WHEN v."costPriceMoney" IS NULL AND v."costPrice" IS NOT NULL THEN jsonb_build_object(
    'primary', 'usd',
    'authored', jsonb_build_array('usd'),
    'amounts', jsonb_build_object('usd', v."costPrice")
      || CASE WHEN r.eur > 0 THEN jsonb_build_object('eur', round(v."costPrice" * r.eur)::bigint) ELSE '{}'::jsonb END
      || CASE WHEN r.rsd > 0 THEN jsonb_build_object('rsd', (round(v."costPrice" * r.rsd / 100) * 100)::bigint) ELSE '{}'::jsonb END,
    'rates', jsonb_build_object('usd', 1)
      || CASE WHEN r.eur > 0 THEN jsonb_build_object('eur', r.eur) ELSE '{}'::jsonb END
      || CASE WHEN r.rsd > 0 THEN jsonb_build_object('rsd', r.rsd) ELSE '{}'::jsonb END
  ) ELSE v."costPriceMoney" END
FROM _backfill_rates r
WHERE v."priceMoney" IS NULL
   OR (v."compareAtPriceMoney" IS NULL AND v."compareAtPrice" IS NOT NULL)
   OR (v."costPriceMoney" IS NULL AND v."costPrice" IS NOT NULL);

-- ProductHistory
UPDATE "ProductHistory" h SET
  "priceMoney" = jsonb_build_object(
    'primary', 'usd',
    'authored', jsonb_build_array('usd'),
    'amounts', jsonb_build_object('usd', h."price")
      || CASE WHEN r.eur > 0 THEN jsonb_build_object('eur', round(h."price" * r.eur)::bigint) ELSE '{}'::jsonb END
      || CASE WHEN r.rsd > 0 THEN jsonb_build_object('rsd', (round(h."price" * r.rsd / 100) * 100)::bigint) ELSE '{}'::jsonb END,
    'rates', jsonb_build_object('usd', 1)
      || CASE WHEN r.eur > 0 THEN jsonb_build_object('eur', r.eur) ELSE '{}'::jsonb END
      || CASE WHEN r.rsd > 0 THEN jsonb_build_object('rsd', r.rsd) ELSE '{}'::jsonb END
  )
FROM _backfill_rates r
WHERE h."priceMoney" IS NULL;

-- Organization delivery rule
UPDATE "Organization" o SET
  "shippingFlatRateMoney" = CASE WHEN o."shippingFlatRateMoney" IS NULL THEN jsonb_build_object(
    'primary', 'usd',
    'authored', jsonb_build_array('usd'),
    'amounts', jsonb_build_object('usd', o."shippingFlatRate")
      || CASE WHEN r.eur > 0 THEN jsonb_build_object('eur', round(o."shippingFlatRate" * r.eur)::bigint) ELSE '{}'::jsonb END
      || CASE WHEN r.rsd > 0 THEN jsonb_build_object('rsd', (round(o."shippingFlatRate" * r.rsd / 100) * 100)::bigint) ELSE '{}'::jsonb END,
    'rates', jsonb_build_object('usd', 1)
      || CASE WHEN r.eur > 0 THEN jsonb_build_object('eur', r.eur) ELSE '{}'::jsonb END
      || CASE WHEN r.rsd > 0 THEN jsonb_build_object('rsd', r.rsd) ELSE '{}'::jsonb END
  ) ELSE o."shippingFlatRateMoney" END,
  "shippingFreeThresholdMoney" = CASE WHEN o."shippingFreeThresholdMoney" IS NULL AND o."shippingFreeThreshold" IS NOT NULL THEN jsonb_build_object(
    'primary', 'usd',
    'authored', jsonb_build_array('usd'),
    'amounts', jsonb_build_object('usd', o."shippingFreeThreshold")
      || CASE WHEN r.eur > 0 THEN jsonb_build_object('eur', round(o."shippingFreeThreshold" * r.eur)::bigint) ELSE '{}'::jsonb END
      || CASE WHEN r.rsd > 0 THEN jsonb_build_object('rsd', (round(o."shippingFreeThreshold" * r.rsd / 100) * 100)::bigint) ELSE '{}'::jsonb END,
    'rates', jsonb_build_object('usd', 1)
      || CASE WHEN r.eur > 0 THEN jsonb_build_object('eur', r.eur) ELSE '{}'::jsonb END
      || CASE WHEN r.rsd > 0 THEN jsonb_build_object('rsd', r.rsd) ELSE '{}'::jsonb END
  ) ELSE o."shippingFreeThresholdMoney" END
FROM _backfill_rates r
WHERE o."shippingFlatRateMoney" IS NULL
   OR (o."shippingFreeThresholdMoney" IS NULL AND o."shippingFreeThreshold" IS NOT NULL);

-- Coupon. `value` is money only on a FIXED coupon - on a PERCENT one it is a
-- percentage, and turning 20 into "$0.20" would be a real corruption.
UPDATE "Coupon" c SET
  "valueMoney" = CASE WHEN c."valueMoney" IS NULL AND c."type" = 'FIXED' THEN jsonb_build_object(
    'primary', 'usd',
    'authored', jsonb_build_array('usd'),
    'amounts', jsonb_build_object('usd', c."value")
      || CASE WHEN r.eur > 0 THEN jsonb_build_object('eur', round(c."value" * r.eur)::bigint) ELSE '{}'::jsonb END
      || CASE WHEN r.rsd > 0 THEN jsonb_build_object('rsd', (round(c."value" * r.rsd / 100) * 100)::bigint) ELSE '{}'::jsonb END,
    'rates', jsonb_build_object('usd', 1)
      || CASE WHEN r.eur > 0 THEN jsonb_build_object('eur', r.eur) ELSE '{}'::jsonb END
      || CASE WHEN r.rsd > 0 THEN jsonb_build_object('rsd', r.rsd) ELSE '{}'::jsonb END
  ) ELSE c."valueMoney" END,
  "minOrderMoney" = CASE WHEN c."minOrderMoney" IS NULL AND c."minOrder" IS NOT NULL THEN jsonb_build_object(
    'primary', 'usd',
    'authored', jsonb_build_array('usd'),
    'amounts', jsonb_build_object('usd', c."minOrder")
      || CASE WHEN r.eur > 0 THEN jsonb_build_object('eur', round(c."minOrder" * r.eur)::bigint) ELSE '{}'::jsonb END
      || CASE WHEN r.rsd > 0 THEN jsonb_build_object('rsd', (round(c."minOrder" * r.rsd / 100) * 100)::bigint) ELSE '{}'::jsonb END,
    'rates', jsonb_build_object('usd', 1)
      || CASE WHEN r.eur > 0 THEN jsonb_build_object('eur', r.eur) ELSE '{}'::jsonb END
      || CASE WHEN r.rsd > 0 THEN jsonb_build_object('rsd', r.rsd) ELSE '{}'::jsonb END
  ) ELSE c."minOrderMoney" END
FROM _backfill_rates r
WHERE (c."valueMoney" IS NULL AND c."type" = 'FIXED')
   OR (c."minOrderMoney" IS NULL AND c."minOrder" IS NOT NULL);

DROP VIEW _backfill_rates;
