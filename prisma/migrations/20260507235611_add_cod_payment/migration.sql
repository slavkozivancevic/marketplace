-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('STRIPE', 'COD');

-- AlterEnum
ALTER TYPE "OrderStatus" ADD VALUE 'PENDING_COD';

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'STRIPE',
ALTER COLUMN "stripeSessionId" DROP NOT NULL;
