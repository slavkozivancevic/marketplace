/*
  Warnings:

  - You are about to alter the column `price` on the `Product` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(10,2)`.

*/
-- DropIndex
DROP INDEX "Product_deletedAt_idx";

-- DropIndex
DROP INDEX "Product_organizationId_idx";

-- DropIndex
DROP INDEX "Product_title_idx";

-- AlterTable
ALTER TABLE "Product" ALTER COLUMN "price" SET DATA TYPE DECIMAL(10,2);

-- CreateIndex
CREATE INDEX "Product_organizationId_deletedAt_idx" ON "Product"("organizationId", "deletedAt");

-- CreateIndex
CREATE INDEX "Product_organizationId_title_idx" ON "Product"("organizationId", "title");
