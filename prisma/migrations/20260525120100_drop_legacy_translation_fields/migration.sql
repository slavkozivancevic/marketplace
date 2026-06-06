-- Drops the legacy translatable columns from Brand, Category, Product and
-- VariantOption. Data has been migrated to the new {Entity}Translation
-- tables by `prisma/backfill-translations.ts`.

-- DropIndex
DROP INDEX "Brand_slug_key";

-- DropIndex
DROP INDEX "Category_slug_parentId_key";

-- DropIndex
DROP INDEX "Product_organizationId_slug_key";

-- DropIndex
DROP INDEX "Product_organizationId_title_idx";

-- DropIndex
DROP INDEX "Product_searchText_idx";

-- AlterTable
ALTER TABLE "Brand"
  DROP COLUMN "description",
  DROP COLUMN "name",
  DROP COLUMN "slug",
  DROP COLUMN "translations";

-- AlterTable
ALTER TABLE "Category"
  DROP COLUMN "description",
  DROP COLUMN "name",
  DROP COLUMN "slug",
  DROP COLUMN "translations";

-- AlterTable
ALTER TABLE "Product"
  DROP COLUMN "description",
  DROP COLUMN "metaDescription",
  DROP COLUMN "metaTitle",
  DROP COLUMN "searchText",
  DROP COLUMN "shortDescription",
  DROP COLUMN "slug",
  DROP COLUMN "title",
  DROP COLUMN "translations";

-- AlterTable
ALTER TABLE "VariantOption"
  DROP COLUMN "name",
  DROP COLUMN "translations";