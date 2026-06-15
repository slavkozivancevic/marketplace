-- CreateEnum
CREATE TYPE "ReturnStatus" AS ENUM ('REQUESTED', 'APPROVED', 'REJECTED', 'SHIPPED', 'REFUNDED');

-- CreateTable
CREATE TABLE "Return" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "ReturnStatus" NOT NULL DEFAULT 'REQUESTED',
    "reason" TEXT,
    "resolutionNote" TEXT,
    "refundAmount" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Return_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Return_orderId_idx" ON "Return"("orderId");

-- CreateIndex
CREATE INDEX "Return_organizationId_status_idx" ON "Return"("organizationId", "status");

-- CreateIndex
CREATE INDEX "Return_userId_idx" ON "Return"("userId");

-- AddForeignKey
ALTER TABLE "Return" ADD CONSTRAINT "Return_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Return" ADD CONSTRAINT "Return_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Return" ADD CONSTRAINT "Return_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
