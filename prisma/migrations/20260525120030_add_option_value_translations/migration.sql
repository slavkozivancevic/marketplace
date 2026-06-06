-- Add per-locale `values` JSON column to VariantOptionTranslation. Stores
-- the map of original option-value strings to their localized counterpart
-- (e.g. `{ "Red": "Crvena" }`).
ALTER TABLE "VariantOptionTranslation" ADD COLUMN "values" JSONB;