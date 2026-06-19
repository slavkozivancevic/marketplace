-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('UNPAID', 'PAID', 'REFUNDED');

-- CreateEnum
CREATE TYPE "FulfillmentStatus" AS ENUM ('UNFULFILLED', 'PARTIALLY_FULFILLED', 'FULFILLED', 'DELIVERED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "OrderStatus" ADD VALUE 'PROCESSING';
ALTER TYPE "OrderStatus" ADD VALUE 'SHIPPED';
ALTER TYPE "OrderStatus" ADD VALUE 'DELIVERED';

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "fulfillmentStatus" "FulfillmentStatus" NOT NULL DEFAULT 'UNFULFILLED',
ADD COLUMN     "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'UNPAID';

-- Backfill the two axes for existing orders from the legacy status + shipments.
-- (We deliberately do NOT update "status" here: new OrderStatus values added in
--  this same migration cannot be used in the same transaction. The display stage
--  is derived from the axes in the app; the stored status is only for filtering.)

-- Payment axis
UPDATE "Order" SET "paymentStatus" = 'PAID' WHERE "status" = 'COMPLETED';
UPDATE "Order" SET "paymentStatus" = 'REFUNDED' WHERE "status" = 'REFUNDED';

-- Cancellation
UPDATE "Order" SET "cancelledAt" = "updatedAt" WHERE "status" = 'CANCELLED';

-- Fulfillment axis
UPDATE "Order" SET "fulfillmentStatus" = 'DELIVERED' WHERE "status" = 'AWAITING_PAYMENT';
UPDATE "Order" SET "fulfillmentStatus" = 'DELIVERED' WHERE "status" = 'COMPLETED' AND "paymentMethod" = 'COD';
UPDATE "Order" o SET "fulfillmentStatus" = 'FULFILLED'
  WHERE o."fulfillmentStatus" = 'UNFULFILLED'
    AND EXISTS (SELECT 1 FROM "Shipment" s WHERE s."orderId" = o."id");
