-- AlterTable
ALTER TABLE "ProductVariant" ADD COLUMN     "order" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "VariantOption" ADD COLUMN     "order" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "VariantOptionValue" ADD COLUMN     "order" INTEGER NOT NULL DEFAULT 0;
