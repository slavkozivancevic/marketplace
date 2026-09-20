-- Credits back the coupon the platform promised to fund, on COD parts that were
-- charged commission on the gross goods before the per-part rule existed.
--
-- Until `order_seller_part`, `markCodPaymentReceived` accrued the FULL
-- commission on a seller's goods. On an order carrying a coupon the buyer had
-- already paid LESS at the door - the coupon comes off the cash the courier
-- collects - so charging the whole commission on top left the SELLER funding a
-- discount the platform advertises as its own. That is now fixed at the source:
-- the accrual is `platformFee(itemsSubtotal) - discountShare`.
--
-- Two problems remain for the rows already on the books, and this migration
-- settles both:
--
--   1. The seller is out of pocket by their coupon share, on business that is
--      already closed. It is given back.
--   2. Every figure the app now derives assumes the netted accrual. A return on
--      such an order reverses `fee - couponSlice` against a balance that took
--      `fee`, so the seller would be left owing commission, for ever, on goods
--      they no longer have - and the refund path deliberately no longer clamps
--      at zero, so nothing would catch it.
--
-- Scope is decided by the FEE row itself: an accrual booked at the GROSS
-- commission while its part carries a coupon share can only have come from the
-- old rule, because the current one books `fee - discountShare`, which cannot
-- equal the gross while that share is positive. So this is safe to run on a
-- database where the new rule has already settled parts (a developer's own) -
-- those rows simply do not match.
--
-- The 10% is `PLATFORM_FEE_PERCENT` (src/features/payments/config.ts), repeated
-- here because a migration cannot import app code - the same standing deal as
-- the coupon split in `order_seller_part`. Read the two together if it changes.
--
-- A part that has since been fully returned needs nothing: the old rule reversed
-- the gross it had charged, so those books already close at zero. One that was
-- partly returned gave back too much, by the coupon riding on the returned
-- units, so only the remainder is credited - which is what `LEAST` and the
-- proportional slice below work out.

CREATE TEMP TABLE cod_gross_fee_credits AS
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

DELETE FROM cod_gross_fee_credits WHERE credit <= 0;

-- The correction is a visible ledger entry, not a silent move on the balance.
-- A negative FEE is the platform owing the seller - exactly how a coupon deeper
-- than the commission is recorded today - so the seller's own order page shows
-- it as a credit, with the reason, instead of a running total that shifted for
-- no stated cause.
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
FROM cod_gross_fee_credits c;

-- ...and the running balance follows the entry. Upsert: an org whose balance was
-- settled back to zero may have no row left at all.
INSERT INTO "OrgBalance" ("id", "organizationId", "currency", "owedAmount", "updatedAt")
SELECT
    gen_random_uuid()::text,
    c.org_id,
    c.currency,
    -SUM(c.credit)::int,
    NOW()
FROM cod_gross_fee_credits c
GROUP BY c.org_id, c.currency
ON CONFLICT ("organizationId", "currency")
DO UPDATE SET
    "owedAmount" = "OrgBalance"."owedAmount" + EXCLUDED."owedAmount",
    "updatedAt" = NOW();

DROP TABLE cod_gross_fee_credits;
