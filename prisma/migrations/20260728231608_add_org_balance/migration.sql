-- CreateTable
CREATE TABLE "OrgBalance" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "owedAmount" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrgBalance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OrgBalance_organizationId_currency_key" ON "OrgBalance"("organizationId", "currency");

-- AddForeignKey
ALTER TABLE "OrgBalance" ADD CONSTRAINT "OrgBalance_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
