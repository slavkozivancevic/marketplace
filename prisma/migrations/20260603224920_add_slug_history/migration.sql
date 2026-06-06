-- CreateEnum
CREATE TYPE "SluggedEntityType" AS ENUM ('PRODUCT', 'BRAND', 'CATEGORY');

-- CreateTable
CREATE TABLE "SlugHistory" (
    "id" TEXT NOT NULL,
    "entityType" "SluggedEntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SlugHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SlugHistory_entityType_entityId_idx" ON "SlugHistory"("entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "SlugHistory_entityType_locale_slug_key" ON "SlugHistory"("entityType", "locale", "slug");
