-- Add per-entity translation tables. Old canonical columns (Brand.name,

-- Category.name, Product.title, etc.) and JSON `translations` fields remain

-- in place so the backfill script can read from them. They are dropped in

-- the follow-up migration `drop_legacy_translation_fields` once data has

-- been copied into these tables.



-- CreateTable

CREATE TABLE "BrandTranslation" (

    "id" TEXT NOT NULL,

    "brandId" TEXT NOT NULL,

    "locale" TEXT NOT NULL,

    "name" TEXT NOT NULL,

    "slug" TEXT NOT NULL,

    "description" TEXT,



    CONSTRAINT "BrandTranslation_pkey" PRIMARY KEY ("id")

);



-- CreateTable

CREATE TABLE "CategoryTranslation" (

    "id" TEXT NOT NULL,

    "categoryId" TEXT NOT NULL,

    "locale" TEXT NOT NULL,

    "name" TEXT NOT NULL,

    "slug" TEXT NOT NULL,

    "description" TEXT,



    CONSTRAINT "CategoryTranslation_pkey" PRIMARY KEY ("id")

);



-- CreateTable

CREATE TABLE "ProductTranslation" (

    "id" TEXT NOT NULL,

    "productId" TEXT NOT NULL,

    "locale" TEXT NOT NULL,

    "title" TEXT NOT NULL,

    "slug" TEXT NOT NULL,

    "description" TEXT NOT NULL,

    "shortDescription" TEXT,

    "metaTitle" TEXT,

    "metaDescription" TEXT,

    "searchText" TEXT,



    CONSTRAINT "ProductTranslation_pkey" PRIMARY KEY ("id")

);



-- CreateTable

CREATE TABLE "VariantOptionTranslation" (

    "id" TEXT NOT NULL,

    "optionId" TEXT NOT NULL,

    "locale" TEXT NOT NULL,

    "name" TEXT NOT NULL,



    CONSTRAINT "VariantOptionTranslation_pkey" PRIMARY KEY ("id")

);



-- AlterTable: ProductHistory gets per-locale snapshot field

ALTER TABLE "ProductHistory" ADD COLUMN "translationsSnap" JSONB;



-- CreateIndex

CREATE INDEX "BrandTranslation_brandId_idx" ON "BrandTranslation"("brandId");



-- CreateIndex

CREATE UNIQUE INDEX "BrandTranslation_brandId_locale_key" ON "BrandTranslation"("brandId", "locale");



-- CreateIndex

CREATE UNIQUE INDEX "BrandTranslation_locale_slug_key" ON "BrandTranslation"("locale", "slug");



-- CreateIndex

CREATE INDEX "CategoryTranslation_categoryId_idx" ON "CategoryTranslation"("categoryId");



-- CreateIndex

CREATE UNIQUE INDEX "CategoryTranslation_categoryId_locale_key" ON "CategoryTranslation"("categoryId", "locale");



-- CreateIndex

CREATE UNIQUE INDEX "CategoryTranslation_locale_slug_key" ON "CategoryTranslation"("locale", "slug");



-- CreateIndex

CREATE INDEX "ProductTranslation_productId_idx" ON "ProductTranslation"("productId");



-- CreateIndex

CREATE INDEX "ProductTranslation_locale_title_idx" ON "ProductTranslation"("locale", "title");



-- CreateIndex

CREATE INDEX "ProductTranslation_searchText_idx" ON "ProductTranslation" USING GIN ("searchText" gin_trgm_ops);



-- CreateIndex

CREATE UNIQUE INDEX "ProductTranslation_productId_locale_key" ON "ProductTranslation"("productId", "locale");



-- CreateIndex

CREATE UNIQUE INDEX "ProductTranslation_locale_slug_key" ON "ProductTranslation"("locale", "slug");



-- CreateIndex

CREATE INDEX "VariantOptionTranslation_optionId_idx" ON "VariantOptionTranslation"("optionId");



-- CreateIndex

CREATE UNIQUE INDEX "VariantOptionTranslation_optionId_locale_key" ON "VariantOptionTranslation"("optionId", "locale");



-- AddForeignKey

ALTER TABLE "BrandTranslation" ADD CONSTRAINT "BrandTranslation_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;



-- AddForeignKey

ALTER TABLE "CategoryTranslation" ADD CONSTRAINT "CategoryTranslation_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;



-- AddForeignKey

ALTER TABLE "ProductTranslation" ADD CONSTRAINT "ProductTranslation_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;



-- AddForeignKey

ALTER TABLE "VariantOptionTranslation" ADD CONSTRAINT "VariantOptionTranslation_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "VariantOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;