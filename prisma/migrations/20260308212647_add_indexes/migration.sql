/*
  Warnings:

  - A unique constraint covering the columns `[productId,key]` on the table `ProductImage` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "ProductImage_productId_idx";

-- CreateIndex
CREATE INDEX "Membership_orgId_idx" ON "Membership"("orgId");

-- CreateIndex
CREATE INDEX "Product_organizationId_status_deletedAt_idx" ON "Product"("organizationId", "status", "deletedAt");

-- CreateIndex
CREATE INDEX "ProductImage_productId_order_idx" ON "ProductImage"("productId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "ProductImage_productId_key_key" ON "ProductImage"("productId", "key");
