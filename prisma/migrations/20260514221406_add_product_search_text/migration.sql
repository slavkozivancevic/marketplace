-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "searchText" TEXT;

-- CreateIndex
CREATE INDEX "Product_searchText_idx" ON "Product" USING GIN ("searchText" gin_trgm_ops);
