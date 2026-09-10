-- AlterTable
ALTER TABLE "Coupon" ADD COLUMN     "minOrderMoney" JSONB,
ADD COLUMN     "valueMoney" JSONB;

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "shippingFlatRateMoney" JSONB,
ADD COLUMN     "shippingFreeThresholdMoney" JSONB;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "compareAtPriceMoney" JSONB,
ADD COLUMN     "costPriceMoney" JSONB,
ADD COLUMN     "priceMoney" JSONB;

-- AlterTable
ALTER TABLE "ProductHistory" ADD COLUMN     "priceMoney" JSONB;

-- AlterTable
ALTER TABLE "ProductVariant" ADD COLUMN     "compareAtPriceMoney" JSONB,
ADD COLUMN     "costPriceMoney" JSONB,
ADD COLUMN     "priceMoney" JSONB;
