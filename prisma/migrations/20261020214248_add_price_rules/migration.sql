-- CreateEnum
CREATE TYPE "PriceRuleKind" AS ENUM ('SCHEDULE', 'REGION');

-- CreateEnum
CREATE TYPE "PriceAdjustmentType" AS ENUM ('PERCENT', 'FIXED_PRICE', 'AMOUNT_OFF');

-- CreateEnum
CREATE TYPE "PriceRecurrence" AS ENUM ('NONE', 'DAILY', 'WEEKLY', 'MONTHLY');

-- CreateTable
CREATE TABLE "PriceRule" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT,
    "kind" "PriceRuleKind" NOT NULL,
    "name" TEXT NOT NULL,
    "adjustment" "PriceAdjustmentType" NOT NULL,
    "percentBps" INTEGER,
    "amount" INTEGER,
    "amountMoney" JSONB,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "timezone" TEXT NOT NULL,
    "recurrence" "PriceRecurrence" NOT NULL DEFAULT 'NONE',
    "startMinute" INTEGER,
    "durationMinutes" INTEGER,
    "weekdays" INTEGER[],
    "monthDay" INTEGER,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PriceRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PriceRule_organizationId_idx" ON "PriceRule"("organizationId");

-- CreateIndex
CREATE INDEX "PriceRule_productId_idx" ON "PriceRule"("productId");

-- CreateIndex
CREATE INDEX "PriceRule_variantId_idx" ON "PriceRule"("variantId");

-- AddForeignKey
ALTER TABLE "PriceRule" ADD CONSTRAINT "PriceRule_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceRule" ADD CONSTRAINT "PriceRule_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceRule" ADD CONSTRAINT "PriceRule_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
