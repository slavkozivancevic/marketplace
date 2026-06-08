-- DropForeignKey
ALTER TABLE "VariantOption" DROP CONSTRAINT "VariantOption_productId_fkey";

-- DropForeignKey
ALTER TABLE "VariantOptionTranslation" DROP CONSTRAINT "VariantOptionTranslation_optionId_fkey";

-- DropForeignKey
ALTER TABLE "VariantOptionValue" DROP CONSTRAINT "VariantOptionValue_optionId_fkey";

-- DropForeignKey
ALTER TABLE "VariantOptionValue" DROP CONSTRAINT "VariantOptionValue_variantId_fkey";

-- AlterTable
ALTER TABLE "Attribute" ADD COLUMN     "isVariantDefining" BOOLEAN NOT NULL DEFAULT false;

-- DropTable
DROP TABLE "VariantOption";

-- DropTable
DROP TABLE "VariantOptionTranslation";

-- DropTable
DROP TABLE "VariantOptionValue";

-- CreateTable
CREATE TABLE "ProductVariantAttributeValue" (
    "id" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "attributeId" TEXT NOT NULL,
    "optionId" TEXT NOT NULL,

    CONSTRAINT "ProductVariantAttributeValue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductVariantAttributeValue_variantId_idx" ON "ProductVariantAttributeValue"("variantId");

-- CreateIndex
CREATE INDEX "ProductVariantAttributeValue_attributeId_optionId_idx" ON "ProductVariantAttributeValue"("attributeId", "optionId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductVariantAttributeValue_variantId_attributeId_key" ON "ProductVariantAttributeValue"("variantId", "attributeId");

-- AddForeignKey
ALTER TABLE "ProductVariantAttributeValue" ADD CONSTRAINT "ProductVariantAttributeValue_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductVariantAttributeValue" ADD CONSTRAINT "ProductVariantAttributeValue_attributeId_fkey" FOREIGN KEY ("attributeId") REFERENCES "Attribute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductVariantAttributeValue" ADD CONSTRAINT "ProductVariantAttributeValue_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "AttributeOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;
