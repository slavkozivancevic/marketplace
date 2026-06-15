-- CreateTable
CREATE TABLE "ConnectedAccount" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "stripeAccountId" TEXT NOT NULL,
    "chargesEnabled" BOOLEAN NOT NULL DEFAULT false,
    "payoutsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "detailsSubmitted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConnectedAccount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ConnectedAccount_organizationId_key" ON "ConnectedAccount"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "ConnectedAccount_stripeAccountId_key" ON "ConnectedAccount"("stripeAccountId");

-- AddForeignKey
ALTER TABLE "ConnectedAccount" ADD CONSTRAINT "ConnectedAccount_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
