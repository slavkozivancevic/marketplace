-- Shipment -> OrderSellerPart.
--
-- A Shipment row only existed once a seller had shipped, so there was nowhere to
-- record a seller cancelling its share before that. OrderSellerPart is that row
-- for the whole per-seller lifecycle and is created with the order.
--
-- Prisma generated this as DROP Shipment / CREATE OrderSellerPart, which would
-- have thrown away every fulfilment record and left existing orders with zero
-- parts (making them permanently unfulfillable, since the order's axes are
-- aggregated from its parts). Rewritten by hand so the new table is populated
-- from the existing data BEFORE the old one is dropped.

-- CreateEnum
CREATE TYPE "SellerPartStatus" AS ENUM ('PENDING', 'SHIPPED', 'DELIVERED', 'CANCELLED');

-- CreateTable
CREATE TABLE "OrderSellerPart" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "shippedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "codSettledAt" TIMESTAMP(3),
    "status" "SellerPartStatus" NOT NULL DEFAULT 'PENDING',
    "trackingNumber" TEXT,
    "carrier" TEXT,
    "itemsSubtotal" INTEGER NOT NULL,
    "shippingAmount" INTEGER NOT NULL DEFAULT 0,
    "discountShare" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderSellerPart_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrderSellerPart_orderId_idx" ON "OrderSellerPart"("orderId");

-- CreateIndex
CREATE INDEX "OrderSellerPart_organizationId_idx" ON "OrderSellerPart"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "OrderSellerPart_orderId_organizationId_key" ON "OrderSellerPart"("orderId", "organizationId");

-- AddForeignKey
ALTER TABLE "OrderSellerPart" ADD CONSTRAINT "OrderSellerPart_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderSellerPart" ADD CONSTRAINT "OrderSellerPart_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill: one part per (order, seller), derived from the order's items.
--
-- discountShare splits Order.discountAmount pro rata by itemsSubtotal. The
-- floors are summed per order and the rounding remainder is handed to the
-- largest part (ties broken by organizationId so the result is deterministic),
-- so the shares always add back up to the order's discount exactly.
INSERT INTO "OrderSellerPart" (
    "id",
    "orderId",
    "organizationId",
    "shippedAt",
    "deliveredAt",
    "cancelledAt",
    "codSettledAt",
    "status",
    "trackingNumber",
    "carrier",
    "itemsSubtotal",
    "shippingAmount",
    "discountShare",
    "createdAt",
    "updatedAt"
)
WITH part_base AS (
    SELECT
        oi."orderId"          AS order_id,
        p."organizationId"    AS org_id,
        SUM(oi."price" * oi."quantity")::int AS items_subtotal
    FROM "OrderItem" oi
    JOIN "Product" p ON p."id" = oi."productId"
    GROUP BY oi."orderId", p."organizationId"
),
shares AS (
    SELECT
        pb.order_id,
        pb.org_id,
        pb.items_subtotal,
        o."discountAmount" AS discount_amount,
        CASE
            WHEN SUM(pb.items_subtotal) OVER (PARTITION BY pb.order_id) > 0
                THEN FLOOR(
                    o."discountAmount"::numeric * pb.items_subtotal
                    / SUM(pb.items_subtotal) OVER (PARTITION BY pb.order_id)
                )::int
            ELSE 0
        END AS base_share,
        ROW_NUMBER() OVER (
            PARTITION BY pb.order_id
            ORDER BY pb.items_subtotal DESC, pb.org_id ASC
        ) AS share_rank
    FROM part_base pb
    JOIN "Order" o ON o."id" = pb.order_id
),
with_remainder AS (
    SELECT
        s.*,
        s.discount_amount - SUM(s.base_share) OVER (PARTITION BY s.order_id) AS remainder
    FROM shares s
)
SELECT
    gen_random_uuid()::text,
    wr.order_id,
    wr.org_id,
    sh."shippedAt",
    sh."deliveredAt",
    -- An order that was cancelled as a whole means every one of its parts was.
    o."cancelledAt",
    -- A COD order already marked PAID had its cash confirmed for all sellers.
    -- The seller's FEE row is the exact moment that happened; orders whose fee
    -- rounded to zero have no such row, so the order's own updatedAt stands in.
    CASE
        WHEN o."paymentMethod" = 'COD' AND o."paymentStatus" = 'PAID'
            THEN COALESCE(fee."createdAt", o."updatedAt")
        ELSE NULL
    END,
    CASE
        WHEN o."cancelledAt"  IS NOT NULL THEN 'CANCELLED'
        WHEN sh."deliveredAt" IS NOT NULL THEN 'DELIVERED'
        WHEN sh."shippedAt"   IS NOT NULL THEN 'SHIPPED'
        ELSE 'PENDING'
    END::"SellerPartStatus",
    sh."trackingNumber",
    sh."carrier",
    wr.items_subtotal,
    COALESCE((o."shippingByOrg" ->> wr.org_id)::int, 0),
    wr.base_share + CASE WHEN wr.share_rank = 1 THEN wr.remainder ELSE 0 END,
    o."createdAt",
    CURRENT_TIMESTAMP
FROM with_remainder wr
JOIN "Order" o ON o."id" = wr.order_id
LEFT JOIN "Shipment" sh
    ON sh."orderId" = wr.order_id AND sh."organizationId" = wr.org_id
LEFT JOIN LATERAL (
    SELECT pt."createdAt"
    FROM "PaymentTransaction" pt
    WHERE pt."orderId" = wr.order_id
      AND pt."organizationId" = wr.org_id
      AND pt."type" = 'FEE'
    ORDER BY pt."createdAt" ASC
    LIMIT 1
) fee ON TRUE;

-- Safety net: a Shipment whose (order, seller) has no matching order items -
-- possible only if a product changed organization after the order - would be
-- silently destroyed by the DROP below. Fail loudly instead.
DO $$
DECLARE
    orphaned int;
BEGIN
    SELECT COUNT(*) INTO orphaned
    FROM "Shipment" sh
    WHERE NOT EXISTS (
        SELECT 1
        FROM "OrderSellerPart" osp
        WHERE osp."orderId" = sh."orderId"
          AND osp."organizationId" = sh."organizationId"
    );

    IF orphaned > 0 THEN
        RAISE EXCEPTION
            'order_seller_part backfill: % Shipment row(s) have no matching order items - aborting rather than dropping fulfilment data',
            orphaned;
    END IF;
END $$;

-- DropForeignKey
ALTER TABLE "Shipment" DROP CONSTRAINT "Shipment_orderId_fkey";

-- DropForeignKey
ALTER TABLE "Shipment" DROP CONSTRAINT "Shipment_organizationId_fkey";

-- DropTable
DROP TABLE "Shipment";
