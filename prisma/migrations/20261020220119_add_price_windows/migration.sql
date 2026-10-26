-- Dynamic pricing, phase 2: the effective-price read model, price windows,
-- the Omnibus price ledger and order-line attribution.
--
-- Hand-edited after `migrate dev --create-only`: the generated version added
-- `effectivePrice` / `effectivePriceMoney` as NOT NULL with no default, which
-- cannot run against existing rows. Here they are added nullable, backfilled
-- from the base price, and only then made NOT NULL. The triggers at the end
-- keep them in step with the base price from now on.

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "priceRuleId" TEXT,
ADD COLUMN     "priceRuleLabel" TEXT;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "effectiveCompareAtPrice" INTEGER,
ADD COLUMN     "effectiveCompareAtPriceMoney" JSONB,
ADD COLUMN     "effectivePrice" INTEGER,
ADD COLUMN     "effectivePriceMoney" JSONB,
ADD COLUMN     "effectiveRuleId" TEXT,
ADD COLUMN     "effectiveRuleLabel" TEXT,
ADD COLUMN     "effectiveUntil" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ProductVariant" ADD COLUMN     "effectiveCompareAtPrice" INTEGER,
ADD COLUMN     "effectiveCompareAtPriceMoney" JSONB,
ADD COLUMN     "effectivePrice" INTEGER,
ADD COLUMN     "effectivePriceMoney" JSONB,
ADD COLUMN     "effectiveRuleId" TEXT,
ADD COLUMN     "effectiveRuleLabel" TEXT,
ADD COLUMN     "effectiveUntil" TIMESTAMP(3);

-- Backfill: with no rules anywhere yet, the effective price IS the base price.
UPDATE "Product" SET
  "effectivePrice" = "price",
  "effectivePriceMoney" = "priceMoney",
  "effectiveCompareAtPrice" = "compareAtPrice",
  "effectiveCompareAtPriceMoney" = "compareAtPriceMoney";

UPDATE "ProductVariant" SET
  "effectivePrice" = "price",
  "effectivePriceMoney" = "priceMoney",
  "effectiveCompareAtPrice" = "compareAtPrice",
  "effectiveCompareAtPriceMoney" = "compareAtPriceMoney";

ALTER TABLE "Product" ALTER COLUMN "effectivePrice" SET NOT NULL,
ALTER COLUMN "effectivePriceMoney" SET NOT NULL;

ALTER TABLE "ProductVariant" ALTER COLUMN "effectivePrice" SET NOT NULL,
ALTER COLUMN "effectivePriceMoney" SET NOT NULL;

-- CreateTable
CREATE TABLE "PriceWindow" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT,
    "ruleId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PriceWindow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PricePoint" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT,
    "price" INTEGER NOT NULL,
    "priceMoney" JSONB NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "PricePoint_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PriceWindow_productId_variantId_startsAt_idx" ON "PriceWindow"("productId", "variantId", "startsAt");

-- CreateIndex
CREATE INDEX "PriceWindow_endsAt_idx" ON "PriceWindow"("endsAt");

-- CreateIndex
CREATE INDEX "PricePoint_productId_variantId_startedAt_idx" ON "PricePoint"("productId", "variantId", "startedAt");

-- CreateIndex
CREATE INDEX "PricePoint_endedAt_idx" ON "PricePoint"("endedAt");

-- CreateIndex
CREATE INDEX "Product_effectivePrice_idx" ON "Product"("effectivePrice");

-- CreateIndex
CREATE INDEX "Product_effectiveUntil_idx" ON "Product"("effectiveUntil");

-- CreateIndex
CREATE INDEX "ProductVariant_effectiveUntil_idx" ON "ProductVariant"("effectiveUntil");

-- Open the Omnibus ledger: every existing product and variant starts with
-- one open price point at its current price.
INSERT INTO "PricePoint" ("id", "productId", "variantId", "price", "priceMoney", "startedAt")
SELECT gen_random_uuid()::text, "id", NULL, "price", "priceMoney", CURRENT_TIMESTAMP
FROM "Product";

INSERT INTO "PricePoint" ("id", "productId", "variantId", "price", "priceMoney", "startedAt")
SELECT gen_random_uuid()::text, "productId", "id", "price", "priceMoney", CURRENT_TIMESTAMP
FROM "ProductVariant";

-- Keeps the read model in step with the base price on EVERY write path - the
-- product form, bulk edit, CSV import, duplication, seeds and scripts - without
-- any of them knowing it exists.
--
-- INSERT: the effective price starts as the base price, whatever the caller
-- sent (Prisma sends nothing: the columns are @default(dbgenerated())), and the
-- ledger gets its first point.
--
-- UPDATE of a base price column: if the target has no current or future price
-- window, nothing can change its price but the base, so the base is copied
-- straight across and the ledger records it - zero-rule behaviour is exactly
-- what it was before this feature. If a window exists, the price depends on
-- the rule, which is application logic, so the row is only marked due
-- (`effectiveUntil = now`) and the next reader rolls it.
--
-- `now()` / CURRENT_TIMESTAMP is the database's clock, the same one readers use
-- to decide what is due.
CREATE FUNCTION pricing_sync_effective_price() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  target_product TEXT;
  target_variant TEXT;
BEGIN
  IF TG_TABLE_NAME = 'Product' THEN
    target_product := NEW."id";
    target_variant := NULL;
  ELSE
    target_product := NEW."productId";
    target_variant := NEW."id";
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF (NEW."price", NEW."priceMoney", NEW."compareAtPrice", NEW."compareAtPriceMoney")
       IS NOT DISTINCT FROM
       (OLD."price", OLD."priceMoney", OLD."compareAtPrice", OLD."compareAtPriceMoney") THEN
      RETURN NEW;
    END IF;

    IF EXISTS (
      SELECT 1 FROM "PriceWindow" w
      WHERE w."productId" = target_product
        AND w."variantId" IS NOT DISTINCT FROM target_variant
        AND w."endsAt" > CURRENT_TIMESTAMP
    ) THEN
      NEW."effectiveUntil" := CURRENT_TIMESTAMP;
      RETURN NEW;
    END IF;
  END IF;

  NEW."effectivePrice" := NEW."price";
  NEW."effectivePriceMoney" := NEW."priceMoney";
  NEW."effectiveCompareAtPrice" := NEW."compareAtPrice";
  NEW."effectiveCompareAtPriceMoney" := NEW."compareAtPriceMoney";
  NEW."effectiveRuleId" := NULL;
  NEW."effectiveRuleLabel" := NULL;
  NEW."effectiveUntil" := NULL;

  -- Ledger: close the open point and open one at the new price, but only when
  -- the price itself moved (a compare-at edit is not a price change).
  IF TG_OP = 'INSERT' OR NEW."price" IS DISTINCT FROM OLD."price"
     OR NEW."priceMoney" IS DISTINCT FROM OLD."priceMoney" THEN
    UPDATE "PricePoint" SET "endedAt" = CURRENT_TIMESTAMP
    WHERE "productId" = target_product
      AND "variantId" IS NOT DISTINCT FROM target_variant
      AND "endedAt" IS NULL;
    INSERT INTO "PricePoint" ("id", "productId", "variantId", "price", "priceMoney", "startedAt")
    VALUES (gen_random_uuid()::text, target_product, target_variant,
            NEW."price", NEW."priceMoney", CURRENT_TIMESTAMP);
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "Product_sync_effective_price_insert"
BEFORE INSERT ON "Product"
FOR EACH ROW EXECUTE FUNCTION pricing_sync_effective_price();

CREATE TRIGGER "Product_sync_effective_price_update"
BEFORE UPDATE OF "price", "priceMoney", "compareAtPrice", "compareAtPriceMoney" ON "Product"
FOR EACH ROW EXECUTE FUNCTION pricing_sync_effective_price();

CREATE TRIGGER "ProductVariant_sync_effective_price_insert"
BEFORE INSERT ON "ProductVariant"
FOR EACH ROW EXECUTE FUNCTION pricing_sync_effective_price();

CREATE TRIGGER "ProductVariant_sync_effective_price_update"
BEFORE UPDATE OF "price", "priceMoney", "compareAtPrice", "compareAtPriceMoney" ON "ProductVariant"
FOR EACH ROW EXECUTE FUNCTION pricing_sync_effective_price();
