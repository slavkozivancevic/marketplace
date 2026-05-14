-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "isFeatured" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Category_isActive_parentId_idx" ON "Category"("isActive", "parentId");

-- CreateIndex
CREATE INDEX "Category_isFeatured_idx" ON "Category"("isFeatured");
