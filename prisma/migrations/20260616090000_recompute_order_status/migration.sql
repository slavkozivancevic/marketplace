-- Recompute the derived display stage for every order from the two real axes.
-- Safe now (separate migration): the PROCESSING/SHIPPED/DELIVERED enum values
-- were added and committed by the previous migration, so they can be used here.
-- Mirrors deriveOrderStatus() in src/features/orders/status.ts.
UPDATE "Order" SET "status" =
  CASE
    WHEN "cancelledAt" IS NOT NULL THEN 'CANCELLED'
    WHEN "paymentStatus" = 'REFUNDED' THEN 'REFUNDED'
    WHEN "paymentStatus" = 'PAID' AND "fulfillmentStatus" = 'DELIVERED' THEN 'COMPLETED'
    WHEN "fulfillmentStatus" = 'DELIVERED' THEN 'DELIVERED'
    WHEN "fulfillmentStatus" IN ('FULFILLED', 'PARTIALLY_FULFILLED') THEN 'SHIPPED'
    WHEN "paymentStatus" = 'PAID' THEN 'PROCESSING'
    ELSE 'PENDING'
  END::"OrderStatus";
