-- AlterTable
ALTER TABLE "ProductVariant" ADD COLUMN     "imageId" TEXT;

-- CreateIndex
CREATE INDEX "ProductVariant_imageId_idx" ON "ProductVariant"("imageId");

-- AddForeignKey
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "ProductImage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
