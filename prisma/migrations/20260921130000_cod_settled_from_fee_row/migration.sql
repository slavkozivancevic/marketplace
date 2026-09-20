-- Marks the COD parts whose cash WAS confirmed but whose order had since moved
-- off PAID - and pays them the coupon credit the previous migration missed.
--
-- `order_seller_part` backfilled `codSettledAt` from the ORDER's payment axis:
--
--     WHEN o."paymentMethod" = 'COD' AND o."paymentStatus" = 'PAID'
--
-- which is true only while nothing has been given back. A COD order that was
-- collected and then partly returned sits at PARTIALLY_REFUNDED, so its part was
-- left saying the cash never came in - and `cod_gross_commission_credit`, which
-- keys on `codSettledAt`, skipped it and left that seller short.
--
-- The honest marker is the seller's own COD FEE row. It is written by
-- `markCodPaymentReceived` at the moment that seller confirms its cash, and
-- nothing else writes one, so its timestamp IS the settlement. Correction rows
-- from the previous migration are excluded - those are its output, not a
-- settlement - and a cancelled part is left alone: it never collected anything.

-- Correlated subqueries, not an UPDATE ... FROM LATERAL: the row being updated
-- is not part of the FROM list, so a lateral there cannot see `sp` at all
-- (Postgres 42P10).
UPDATE "OrderSellerPart" sp
SET "codSettledAt" = (
    SELECT MIN(fee."createdAt")
    FROM "PaymentTransaction" fee
    WHERE fee."orderId" = sp."orderId"
      AND fee."organizationId" = sp."organizationId"
      AND fee.type = 'FEE'
      AND fee.provider = 'COD'
      AND (fee.note IS NULL OR fee.note NOT LIKE 'Correction:%')
)
WHERE sp."codSettledAt" IS NULL
  AND sp."cancelledAt" IS NULL
  AND EXISTS (
      SELECT 1
      FROM "Order" o
      WHERE o.id = sp."orderId"
        AND o."paymentMethod" = 'COD'
  )
  AND EXISTS (
      SELECT 1
      FROM "PaymentTransaction" fee
      WHERE fee."orderId" = sp."orderId"
        AND fee."organizationId" = sp."organizationId"
        AND fee.type = 'FEE'
        AND fee.provider = 'COD'
        AND (fee.note IS NULL OR fee.note NOT LIKE 'Correction:%')
  );

-- The same credit as `cod_gross_commission_credit`, for the parts the line above
-- has just made visible. Read that migration for why the scope is decided by a
-- commission booked at the GROSS while the part carries a coupon share, why a
-- partly returned part is owed only the remainder, and why the correction is a
-- visible ledger entry rather than a silent move on the balance.
--
-- A part that already carries a correction is skipped: it was handled then, and
-- a credit paid twice is the same fault as one never paid.

CREATE TEMP TABLE cod_late_fee_credits AS
WITH gross_accrued AS (
    SELECT
        sp."orderId"        AS order_id,
        sp."organizationId" AS org_id,
        sp."itemsSubtotal"  AS items_subtotal,
        sp."discountShare"  AS discount_share,
        fee.currency        AS currency,
        COALESCE((
            SELECT SUM(r.amount)
            FROM "PaymentTransaction" r
            WHERE r."orderId" = sp."orderId"
              AND r."organizationId" = sp."organizationId"
              AND r.type = 'REFUND'
        ), 0)::int AS refunded_gross
    FROM "OrderSellerPart" sp
    JOIN "PaymentTransaction" fee
      ON fee."orderId" = sp."orderId"
     AND fee."organizationId" = sp."organizationId"
     AND fee.type = 'FEE'
     AND fee.provider = 'COD'
    WHERE sp."codSettledAt" IS NOT NULL
      AND sp."discountShare" > 0
      AND fee.amount = ROUND(sp."itemsSubtotal"::numeric / 10)::int
      AND NOT EXISTS (
          SELECT 1
          FROM "PaymentTransaction" done
          WHERE done."orderId" = sp."orderId"
            AND done."organizationId" = sp."organizationId"
            AND done.type = 'FEE'
            AND done.note LIKE 'Correction:%'
      )
)
SELECT
    order_id,
    org_id,
    currency,
    discount_share
      - ROUND(
          discount_share::numeric
          * LEAST(refunded_gross, items_subtotal)
          / NULLIF(items_subtotal, 0)
        )::int AS credit
FROM gross_accrued;

DELETE FROM cod_late_fee_credits WHERE credit <= 0;

INSERT INTO "PaymentTransaction" (
    "id", "orderId", "type", "status", "provider", "organizationId",
    "amount", "currency", "note", "createdAt", "updatedAt"
)
SELECT
    gen_random_uuid()::text,
    c.order_id,
    'FEE',
    'SUCCEEDED',
    'COD',
    c.org_id,
    -c.credit,
    c.currency,
    'Correction: commission on this order was charged on the full goods value. '
      || 'The coupon share the platform funds is credited back.',
    NOW(),
    NOW()
FROM cod_late_fee_credits c;

INSERT INTO "OrgBalance" ("id", "organizationId", "currency", "owedAmount", "updatedAt")
SELECT
    gen_random_uuid()::text,
    c.org_id,
    c.currency,
    -SUM(c.credit)::int,
    NOW()
FROM cod_late_fee_credits c
GROUP BY c.org_id, c.currency
ON CONFLICT ("organizationId", "currency")
DO UPDATE SET
    "owedAmount" = "OrgBalance"."owedAmount" + EXCLUDED."owedAmount",
    "updatedAt" = NOW();

DROP TABLE cod_late_fee_credits;
