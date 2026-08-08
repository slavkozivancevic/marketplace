-- Drops the legacy single-locale Tag.name/slug columns. Data has been
-- migrated to TagTranslation by `prisma/backfill-tag-translations.ts`.

-- DropIndex
DROP INDEX "Tag_name_key";

-- DropIndex
DROP INDEX "Tag_slug_key";

-- AlterTable
ALTER TABLE "Tag"
  DROP COLUMN "name",
  DROP COLUMN "slug";
