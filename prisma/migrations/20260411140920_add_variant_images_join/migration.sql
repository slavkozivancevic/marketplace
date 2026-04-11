/*
  Warnings:

  - You are about to drop the column `imageId` on the `ProductVariant` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "ProductVariant" DROP CONSTRAINT "ProductVariant_imageId_fkey";

-- DropIndex
DROP INDEX "ProductVariant_imageId_idx";

-- AlterTable
ALTER TABLE "ProductVariant" DROP COLUMN "imageId";

-- CreateTable
CREATE TABLE "ProductVariantImage" (
    "variantId" TEXT NOT NULL,
    "imageId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductVariantImage_pkey" PRIMARY KEY ("variantId","imageId")
);

-- CreateIndex
CREATE INDEX "ProductVariantImage_variantId_idx" ON "ProductVariantImage"("variantId");

-- CreateIndex
CREATE INDEX "ProductVariantImage_imageId_idx" ON "ProductVariantImage"("imageId");

-- AddForeignKey
ALTER TABLE "ProductVariantImage" ADD CONSTRAINT "ProductVariantImage_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductVariantImage" ADD CONSTRAINT "ProductVariantImage_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "ProductImage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
