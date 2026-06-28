-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "shippingByOrg" JSONB,
ADD COLUMN     "shippingTotal" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "shippingFlatRate" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "shippingFreeThreshold" INTEGER;
