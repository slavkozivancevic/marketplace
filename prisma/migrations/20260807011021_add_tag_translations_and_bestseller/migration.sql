-- Adds TagTranslation (Tag.name/slug become per-locale, mirroring Brand/
-- Category). Old Tag.name/slug columns are left in place so
-- `prisma/backfill-tag-translations.ts` can copy them into the new table;
-- they are dropped in the follow-up migration `drop_legacy_tag_fields`.
--
-- Also adds Product.isBestseller (algorithmic badge, recomputed by the
-- marketplace-notifications cron - unrelated to Tag/TagTranslation) and
-- SluggedEntityType.TAG (so tag slug renames get 308-redirect history like
-- Brand/Category/Product already do).

-- CreateTable
CREATE TABLE "TagTranslation" (
    "id" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,

    CONSTRAINT "TagTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TagTranslation_tagId_idx" ON "TagTranslation"("tagId");

-- CreateIndex
CREATE UNIQUE INDEX "TagTranslation_tagId_locale_key" ON "TagTranslation"("tagId", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "TagTranslation_locale_slug_key" ON "TagTranslation"("locale", "slug");

-- AddForeignKey
ALTER TABLE "TagTranslation" ADD CONSTRAINT "TagTranslation_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "Tag"
  ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterEnum
ALTER TYPE "SluggedEntityType" ADD VALUE 'TAG';

-- AlterTable
ALTER TABLE "Product" ADD COLUMN "isBestseller" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Product_isBestseller_idx" ON "Product"("isBestseller");
