-- Migration: integer_prices_and_multicurrency
-- Converts all price columns from DECIMAL to INTEGER (smallest currency unit = cents/para)
-- and adds multi-currency support to the Order model.

-- ─── Product ──────────────────────────────────────────────────────────────────
ALTER TABLE "Product"
  ALTER COLUMN "price" TYPE INTEGER
    USING ROUND("price" * 100)::INTEGER,
  ALTER COLUMN "compareAtPrice" TYPE INTEGER
    USING CASE WHEN "compareAtPrice" IS NULL THEN NULL
               ELSE ROUND("compareAtPrice" * 100)::INTEGER END,
  ALTER COLUMN "costPrice" TYPE INTEGER
    USING CASE WHEN "costPrice" IS NULL THEN NULL
               ELSE ROUND("costPrice" * 100)::INTEGER END;

-- ─── ProductVariant ───────────────────────────────────────────────────────────
ALTER TABLE "ProductVariant"
  ALTER COLUMN "price" TYPE INTEGER
    USING ROUND("price" * 100)::INTEGER,
  ALTER COLUMN "compareAtPrice" TYPE INTEGER
    USING CASE WHEN "compareAtPrice" IS NULL THEN NULL
               ELSE ROUND("compareAtPrice" * 100)::INTEGER END,
  ALTER COLUMN "costPrice" TYPE INTEGER
    USING CASE WHEN "costPrice" IS NULL THEN NULL
               ELSE ROUND("costPrice" * 100)::INTEGER END;

-- ─── ProductHistory ───────────────────────────────────────────────────────────
ALTER TABLE "ProductHistory"
  ALTER COLUMN "price" TYPE INTEGER
    USING ROUND("price" * 100)::INTEGER;

-- ─── Order ────────────────────────────────────────────────────────────────────
ALTER TABLE "Order"
  ALTER COLUMN "total" TYPE INTEGER
    USING ROUND("total" * 100)::INTEGER;

-- currency was added by the previous migration (add_cod_payment).
-- Only add it if it doesn't already exist (safe re-run guard).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Order' AND column_name = 'currency'
  ) THEN
    ALTER TABLE "Order" ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'usd';
  END IF;
END $$;

ALTER TABLE "Order"
  ADD COLUMN IF NOT EXISTS "exchangeRate" DECIMAL(12,6) NOT NULL DEFAULT 1;

-- ─── OrderItem ────────────────────────────────────────────────────────────────
ALTER TABLE "OrderItem"
  ALTER COLUMN "price" TYPE INTEGER
    USING ROUND("price" * 100)::INTEGER;

-- ─── CurrencyRate ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "CurrencyRate" (
  "code"      TEXT NOT NULL,
  "rate"      DECIMAL(12,6) NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  CONSTRAINT "CurrencyRate_pkey" PRIMARY KEY ("code")
);

-- Seed approximate rates (admin can update these via the dashboard)
INSERT INTO "CurrencyRate" ("code", "rate", "updatedAt") VALUES
  ('eur', 0.921000, NOW()),
  ('rsd', 108.500000, NOW())
ON CONFLICT ("code") DO NOTHING;