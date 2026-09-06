-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "countryOfOrigin" VARCHAR(8),
ADD COLUMN     "warrantyMonths" INTEGER;

-- CreateIndex
CREATE INDEX "Product_countryOfOrigin_idx" ON "Product"("countryOfOrigin");

-- CreateIndex
CREATE INDEX "Product_warrantyMonths_idx" ON "Product"("warrantyMonths");
