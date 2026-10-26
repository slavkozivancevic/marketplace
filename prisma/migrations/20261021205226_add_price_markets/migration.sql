-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "pricingCountry" TEXT;

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "marketRuleId" TEXT,
ADD COLUMN     "marketRuleLabel" TEXT;

-- AlterTable
ALTER TABLE "PriceRule" ADD COLUMN     "countryCode" TEXT,
ADD COLUMN     "marketId" TEXT;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "effectiveSince" TIMESTAMP(3),
ADD COLUMN     "marketRulesChangedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ProductVariant" ADD COLUMN     "effectiveSince" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "PriceMarket" (
    "id" TEXT NOT NULL,
    "isDefault" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PriceMarket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceMarketTranslation" (
    "id" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "PriceMarketTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceMarketCountry" (
    "code" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,

    CONSTRAINT "PriceMarketCountry_pkey" PRIMARY KEY ("code")
);

-- CreateIndex
CREATE UNIQUE INDEX "PriceMarket_isDefault_key" ON "PriceMarket"("isDefault");

-- CreateIndex
CREATE INDEX "PriceMarketTranslation_marketId_idx" ON "PriceMarketTranslation"("marketId");

-- CreateIndex
CREATE UNIQUE INDEX "PriceMarketTranslation_marketId_locale_key" ON "PriceMarketTranslation"("marketId", "locale");

-- CreateIndex
CREATE INDEX "PriceMarketCountry_marketId_idx" ON "PriceMarketCountry"("marketId");

-- CreateIndex
CREATE INDEX "PriceRule_marketId_idx" ON "PriceRule"("marketId");

-- CreateIndex
CREATE INDEX "PriceRule_countryCode_idx" ON "PriceRule"("countryCode");

-- AddForeignKey
ALTER TABLE "PriceRule" ADD CONSTRAINT "PriceRule_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "PriceMarket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceMarketTranslation" ADD CONSTRAINT "PriceMarketTranslation_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "PriceMarket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceMarketCountry" ADD CONSTRAINT "PriceMarketCountry_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "PriceMarket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Hand-written below this line. Prisma models none of it, and none of it is
-- something a later `migrate dev` diffs against.

-- `isDefault` is TRUE or NULL, never FALSE: with FALSE allowed, the unique
-- index would permit only one ordinary market.
ALTER TABLE "PriceMarket" ADD CONSTRAINT "PriceMarket_isDefault_true_or_null"
  CHECK ("isDefault" IS NULL OR "isDefault" = TRUE);

-- A schedule rule has no geography; a market rule targets exactly one market or
-- exactly one country. The db layer and the form check the same thing, this is
-- the last line of defence for a write that skips both.
ALTER TABLE "PriceRule" ADD CONSTRAINT "PriceRule_region_target"
  CHECK (
    ("kind" = 'SCHEDULE' AND "marketId" IS NULL AND "countryCode" IS NULL)
    OR ("kind" = 'REGION' AND (("marketId" IS NULL) <> ("countryCode" IS NULL)))
  );

-- The default market every unmapped country falls into. It must exist before
-- any reader resolves a viewer, so it is created here rather than by a seed.
WITH m AS (
  INSERT INTO "PriceMarket" ("id", "isDefault", "createdAt", "updatedAt")
  VALUES (gen_random_uuid()::text, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  RETURNING "id"
)
INSERT INTO "PriceMarketTranslation" ("id", "marketId", "locale", "name")
SELECT gen_random_uuid()::text, m."id", t.locale, t.name
FROM m, (VALUES
  ('en', 'Rest of world'),
  ('sr', 'Ostatak sveta'),
  ('de', 'Restliche Welt'),
  ('es', 'Resto del mundo')
) AS t(locale, name);
