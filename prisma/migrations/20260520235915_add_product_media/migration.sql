-- Unifies ProductImage + ProductVariantImage into ProductMedia + ProductVariantMedia
-- so the same table can hold both images and videos (mediaType discriminator).
-- All existing rows are copied over with mediaType = 'IMAGE' before the old
-- tables are dropped.

-- 1. New enum
CREATE TYPE "MediaType" AS ENUM ('IMAGE', 'VIDEO');

-- 2. New tables
CREATE TABLE "ProductMedia" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "mediaType" "MediaType" NOT NULL DEFAULT 'IMAGE',
    "url" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "thumbUrl" TEXT,
    "thumbKey" TEXT,
    "mimeType" TEXT,
    "durationMs" INTEGER,
    "width" INTEGER,
    "height" INTEGER,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductMedia_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProductVariantMedia" (
    "variantId" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductVariantMedia_pkey" PRIMARY KEY ("variantId","mediaId")
);

CREATE INDEX "ProductMedia_productId_order_idx" ON "ProductMedia"("productId", "order");
CREATE UNIQUE INDEX "ProductMedia_productId_key_key" ON "ProductMedia"("productId", "key");
CREATE INDEX "ProductVariantMedia_variantId_idx" ON "ProductVariantMedia"("variantId");
CREATE INDEX "ProductVariantMedia_mediaId_idx" ON "ProductVariantMedia"("mediaId");

-- 3. Copy existing image rows (id preserved so variant joins stay intact).
INSERT INTO "ProductMedia" ("id", "productId", "mediaType", "url", "key", "order", "createdAt")
SELECT "id", "productId", 'IMAGE'::"MediaType", "url", "key", "order", "createdAt"
FROM "ProductImage";

INSERT INTO "ProductVariantMedia" ("variantId", "mediaId", "order", "createdAt")
SELECT "variantId", "imageId", "order", "createdAt"
FROM "ProductVariantImage";

-- 4. Drop old tables (FKs go first).
ALTER TABLE "ProductImage" DROP CONSTRAINT "ProductImage_productId_fkey";
ALTER TABLE "ProductVariantImage" DROP CONSTRAINT "ProductVariantImage_imageId_fkey";
ALTER TABLE "ProductVariantImage" DROP CONSTRAINT "ProductVariantImage_variantId_fkey";

DROP TABLE "ProductVariantImage";
DROP TABLE "ProductImage";

-- 5. Wire up FKs on the new tables.
ALTER TABLE "ProductMedia" ADD CONSTRAINT "ProductMedia_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductVariantMedia" ADD CONSTRAINT "ProductVariantMedia_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductVariantMedia" ADD CONSTRAINT "ProductVariantMedia_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "ProductMedia"("id") ON DELETE CASCADE ON UPDATE CASCADE;