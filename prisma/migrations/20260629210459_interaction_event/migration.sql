-- CreateEnum
CREATE TYPE "InteractionType" AS ENUM ('VIEW', 'ADD_TO_CART', 'PURCHASE');

-- CreateTable
CREATE TABLE "InteractionEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "sessionId" TEXT,
    "type" "InteractionType" NOT NULL,
    "productId" TEXT NOT NULL,
    "orderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InteractionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InteractionEvent_userId_type_createdAt_idx" ON "InteractionEvent"("userId", "type", "createdAt");

-- CreateIndex
CREATE INDEX "InteractionEvent_sessionId_type_createdAt_idx" ON "InteractionEvent"("sessionId", "type", "createdAt");

-- CreateIndex
CREATE INDEX "InteractionEvent_productId_type_createdAt_idx" ON "InteractionEvent"("productId", "type", "createdAt");
