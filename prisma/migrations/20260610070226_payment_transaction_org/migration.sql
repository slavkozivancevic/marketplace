-- AlterTable
ALTER TABLE "PaymentTransaction" ADD COLUMN     "organizationId" TEXT;

-- CreateIndex
CREATE INDEX "PaymentTransaction_organizationId_idx" ON "PaymentTransaction"("organizationId");

-- AddForeignKey
ALTER TABLE "PaymentTransaction" ADD CONSTRAINT "PaymentTransaction_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
