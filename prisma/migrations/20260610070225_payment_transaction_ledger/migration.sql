-- CreateEnum
CREATE TYPE "PaymentTransactionType" AS ENUM ('CHARGE', 'REFUND', 'PAYOUT');

-- CreateEnum
CREATE TYPE "PaymentTransactionStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED');

-- CreateTable
CREATE TABLE "PaymentTransaction" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "type" "PaymentTransactionType" NOT NULL,
    "status" "PaymentTransactionStatus" NOT NULL DEFAULT 'SUCCEEDED',
    "provider" "PaymentMethod" NOT NULL,
    "providerId" TEXT,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentTransaction_providerId_key" ON "PaymentTransaction"("providerId");

-- CreateIndex
CREATE INDEX "PaymentTransaction_orderId_idx" ON "PaymentTransaction"("orderId");

-- CreateIndex
CREATE INDEX "PaymentTransaction_type_status_idx" ON "PaymentTransaction"("type", "status");

-- AddForeignKey
ALTER TABLE "PaymentTransaction" ADD CONSTRAINT "PaymentTransaction_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
