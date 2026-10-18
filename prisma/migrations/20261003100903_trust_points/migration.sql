-- CreateTable
CREATE TABLE "TrustPoint" (
    "id" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrustPoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrustPointTranslation" (
    "id" TEXT NOT NULL,
    "trustPointId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sublabel" TEXT,

    CONSTRAINT "TrustPointTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TrustPoint_isActive_order_idx" ON "TrustPoint"("isActive", "order");

-- CreateIndex
CREATE INDEX "TrustPointTranslation_trustPointId_idx" ON "TrustPointTranslation"("trustPointId");

-- CreateIndex
CREATE UNIQUE INDEX "TrustPointTranslation_trustPointId_locale_key" ON "TrustPointTranslation"("trustPointId", "locale");

-- AddForeignKey
ALTER TABLE "TrustPointTranslation" ADD CONSTRAINT "TrustPointTranslation_trustPointId_fkey" FOREIGN KEY ("trustPointId") REFERENCES "TrustPoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;
