-- Omnibus clocks per target. A market rule change now counts only for the
-- buyers it could have priced (its market or its country), and a country move
-- only for that country's buyers - see applyMarket in
-- src/features/pricing/engine/market.ts.

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "marketRuleClocks" JSONB;

-- CreateTable
CREATE TABLE "PriceCountryMove" (
    "code" TEXT NOT NULL,
    "movedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriceCountryMove_pkey" PRIMARY KEY ("code")
);

-- Backfill: each target of a product's current market rules, at the rule's
-- last change. "updatedAt" holds UTC without a zone, so it is tagged UTC before
-- it becomes a JSON string - the string then carries its offset.
UPDATE "Product" p
SET "marketRuleClocks" = c.clocks
FROM (
    SELECT "productId", jsonb_object_agg(k, to_jsonb(t AT TIME ZONE 'UTC')) AS clocks
    FROM (
        SELECT
            "productId",
            CASE WHEN "countryCode" IS NOT NULL THEN 'c:' || "countryCode" ELSE 'm:' || "marketId" END AS k,
            max("updatedAt") AS t
        FROM "PriceRule"
        WHERE "kind" = 'REGION' AND ("countryCode" IS NOT NULL OR "marketId" IS NOT NULL)
        GROUP BY 1, 2
    ) r
    GROUP BY "productId"
) c
WHERE p."id" = c."productId";

-- Backfill: every country now in a market moved at the old map clock (the
-- default market's "updatedAt"), if the map ever changed.
INSERT INTO "PriceCountryMove" ("code", "movedAt")
SELECT mc."code", d."updatedAt"
FROM "PriceMarketCountry" mc
CROSS JOIN "PriceMarket" d
WHERE d."isDefault" = true AND d."updatedAt" > d."createdAt";

-- The single per-product clock is replaced by "marketRuleClocks".
ALTER TABLE "Product" DROP COLUMN "marketRulesChangedAt";
