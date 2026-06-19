import { prisma } from "@/core/db/prisma";
import { stripe } from "@/services/stripe";
import {
  PaymentMethod,
  PaymentTransactionType,
  PaymentTransactionStatus,
} from "@/generated/prisma/client";
import { sellerNetAmount } from "../config";
import { MOCK_CONNECT, isMockAccount } from "../mock";

/**
 * Cursor-paginated payout ledger for a seller org, newest first. Each row carries
 * a `refunded` flag set when the order behind it has a succeeded REFUND, so the UI
 * can show the payout was (partly or fully) clawed back even though the original
 * transfer succeeded.
 *
 * Standard list pattern (see getOrgOrdersPage): fetch take+1, pop the extra into
 * `nextCursor`, stable `[createdAt desc, id asc]` ordering for keyset paging.
 */
/**
 * Order ids that (a) have a payout to this org and (b) carry a succeeded REFUND.
 * Scoped through the order's own payout rows so the set stays small (refunds are
 * rare), letting the list filter by a plain `orderId in / notIn` condition that
 * composes with cursor pagination.
 */
async function getRefundedOrderIdsForOrg(organizationId: string): Promise<string[]> {
  const rows = await prisma.paymentTransaction.findMany({
    where: {
      type: PaymentTransactionType.REFUND,
      status: PaymentTransactionStatus.SUCCEEDED,
      order: {
        paymentTransactions: {
          some: { organizationId, type: PaymentTransactionType.PAYOUT },
        },
      },
    },
    select: { orderId: true },
    distinct: ["orderId"],
  });
  return rows.map((r) => r.orderId);
}

export async function getOrgPayoutsPage({
  organizationId,
  take,
  cursor,
  search,
  status,
  refunded,
  sortBy = "createdAt",
  sortOrder = "desc",
}: {
  organizationId: string;
  take: number;
  cursor?: string;
  search?: string;
  status?: string[];
  refunded?: string[];
  sortBy?: "createdAt" | "amount";
  sortOrder?: "asc" | "desc";
}) {
  // Buyers search by the short order id (last 8 chars), which is a case-folded
  // substring of the stored uuid - so a plain insensitive `contains` matches it.
  const searchConditions = search
    ? [{ orderId: { contains: search, mode: "insensitive" as const } }]
    : [];
  const statusCondition =
    status && status.length > 0
      ? [{ status: { in: status as PaymentTransactionStatus[] } }]
      : [];

  // Only a single-sided selection narrows: empty or both ("refunded"+"active")
  // means show everything.
  const onlyRefunded = refunded?.length === 1 ? refunded[0] : null;
  const refundedCondition =
    onlyRefunded === "refunded"
      ? [{ orderId: { in: await getRefundedOrderIdsForOrg(organizationId) } }]
      : onlyRefunded === "active"
        ? [{ orderId: { notIn: await getRefundedOrderIdsForOrg(organizationId) } }]
        : [];

  const sortField =
    sortBy === "amount"
      ? { amount: sortOrder }
      : { createdAt: sortOrder };

  const rows = await prisma.paymentTransaction.findMany({
    where: {
      organizationId,
      type: PaymentTransactionType.PAYOUT,
      AND: [...searchConditions, ...statusCondition, ...refundedCondition],
    },
    orderBy: [sortField, { id: "asc" }],
    take: take + 1,
    cursor: cursor ? { id: cursor } : undefined,
    skip: cursor ? 1 : 0,
    select: {
      id: true,
      status: true,
      amount: true,
      currency: true,
      createdAt: true,
      orderId: true,
    },
  });

  let nextCursor: string | undefined;
  if (rows.length > take) {
    nextCursor = rows.pop()!.id;
  }

  // Per row, work out how much of the payout was clawed back so the UI can tell
  // a full reversal from a partial one. The payout is the seller's NET share, and
  // a return reverses sellerNetAmount(refundedGross) - so we net the gross too.
  const orderIds = [...new Set(rows.map((r) => r.orderId))];
  const refunds = orderIds.length
    ? await prisma.paymentTransaction.findMany({
        where: {
          orderId: { in: orderIds },
          type: PaymentTransactionType.REFUND,
          status: PaymentTransactionStatus.SUCCEEDED,
        },
        select: { orderId: true, organizationId: true, amount: true },
      })
    : [];

  // org-scoped (return) refund gross per order, and whether an order-level
  // (manual/external) refund exists - the latter claws back the whole payout.
  const orgRefundGross = new Map<string, number>();
  const orderLevelRefunded = new Set<string>();
  for (const r of refunds) {
    if (r.organizationId === organizationId) {
      orgRefundGross.set(r.orderId, (orgRefundGross.get(r.orderId) ?? 0) + r.amount);
    } else if (r.organizationId === null) {
      orderLevelRefunded.add(r.orderId);
    }
  }

  return {
    items: rows.map((p) => {
      const reversedNet = orderLevelRefunded.has(p.orderId)
        ? p.amount
        : Math.min(p.amount, sellerNetAmount(orgRefundGross.get(p.orderId) ?? 0));
      const refundState =
        reversedNet <= 0 ? "none" : reversedNet >= p.amount ? "full" : "partial";
      return { ...p, refundState, reversedNet };
    }),
    nextCursor,
  };
}

export type OrgPayoutListItem = Awaited<
  ReturnType<typeof getOrgPayoutsPage>
>["items"][number];

/**
 * Disjunctive facet counts for the payout list sidebar. Ignores the status and
 * refunded selections themselves but applies the active search and org scope,
 * matching the list query (see getOrgOrderStatusCounts).
 */
export async function getOrgPayoutFacetCounts({
  organizationId,
  search,
}: {
  organizationId: string;
  search?: string;
}): Promise<{ status: Record<string, number>; refunded: Record<string, number> }> {
  const searchConditions = search
    ? [{ orderId: { contains: search, mode: "insensitive" as const } }]
    : [];
  const baseWhere = {
    organizationId,
    type: PaymentTransactionType.PAYOUT,
    AND: [...searchConditions],
  };

  const [groups, refundedOrderIds] = await Promise.all([
    prisma.paymentTransaction.groupBy({
      by: ["status"],
      where: baseWhere,
      _count: { _all: true },
    }),
    getRefundedOrderIdsForOrg(organizationId),
  ]);

  const status: Record<string, number> = {};
  let total = 0;
  for (const g of groups) {
    status[g.status] = g._count._all;
    total += g._count._all;
  }

  const refundedCount = refundedOrderIds.length
    ? await prisma.paymentTransaction.count({
        where: { ...baseWhere, orderId: { in: refundedOrderIds } },
      })
    : 0;

  return {
    status,
    refunded: { refunded: refundedCount, active: total - refundedCount },
  };
}

/**
 * Releases ONE seller's payout for a card order, called when that seller ships
 * its portion - not at payment. The platform holds the captured funds until the
 * seller fulfills, which protects against paying out an order that is refunded
 * before it ever ships (standard marketplace risk management).
 *
 * Transfers the seller's net share (subtotal minus the platform fee) to its
 * connected account and records a PAYOUT ledger row. Idempotent per (order,
 * seller) so re-marking shipped / updating tracking never pays twice. COD orders
 * have no platform-held funds (cash is collected on delivery) and are skipped.
 *
 * Best-effort: a missing account or a failed transfer is recorded (PENDING /
 * FAILED) and never thrown, so it can't undo an already-shipped order.
 */
export async function releaseSellerPayout({
  orderId,
  organizationId,
}: {
  orderId: string;
  organizationId: string;
}): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { paymentMethod: true, currency: true },
  });
  if (!order || order.paymentMethod !== PaymentMethod.STRIPE) return;
  const currency = order.currency;

  // Idempotent: one payout per (order, seller). Re-shipping / tracking edits
  // must never transfer again.
  const existing = await prisma.paymentTransaction.findFirst({
    where: { orderId, organizationId, type: PaymentTransactionType.PAYOUT },
    select: { id: true },
  });
  if (existing) return;

  // This seller's gross subtotal within the order (price stored in order currency).
  const items = await prisma.orderItem.findMany({
    where: { orderId, product: { organizationId } },
    select: { price: true, quantity: true },
  });
  const subtotal = items.reduce((s, it) => s + it.price * it.quantity, 0);
  const net = sellerNetAmount(subtotal);
  if (net <= 0) return;

  const account = await prisma.connectedAccount.findUnique({
    where: { organizationId },
  });

  // Seller not onboarded or payouts not enabled: record what is owed as a
  // PENDING payout so it surfaces in their dashboard and can be settled later.
  if (!account || !account.payoutsEnabled) {
    await prisma.paymentTransaction.create({
      data: {
        orderId,
        organizationId,
        type: PaymentTransactionType.PAYOUT,
        status: PaymentTransactionStatus.PENDING,
        provider: PaymentMethod.STRIPE,
        amount: net,
        currency,
        note: account ? "Payouts not enabled yet" : "Seller not connected",
      },
    });
    return;
  }

  try {
    let providerId: string;
    if (MOCK_CONNECT || isMockAccount(account.stripeAccountId)) {
      providerId = `tr_mock_${orderId}_${organizationId}`;
    } else {
      const transfer = await stripe.transfers.create({
        amount: net,
        currency,
        destination: account.stripeAccountId,
        transfer_group: orderId,
        metadata: { orderId, organizationId },
      });
      providerId = transfer.id;
    }

    await prisma.paymentTransaction.create({
      data: {
        orderId,
        organizationId,
        type: PaymentTransactionType.PAYOUT,
        status: PaymentTransactionStatus.SUCCEEDED,
        provider: PaymentMethod.STRIPE,
        providerId,
        amount: net,
        currency,
      },
    });
  } catch (err) {
    console.error("[releaseSellerPayout] transfer failed", organizationId, err);
    await prisma.paymentTransaction.create({
      data: {
        orderId,
        organizationId,
        type: PaymentTransactionType.PAYOUT,
        status: PaymentTransactionStatus.FAILED,
        provider: PaymentMethod.STRIPE,
        amount: net,
        currency,
        note: err instanceof Error ? err.message.slice(0, 500) : "transfer failed",
      },
    });
  }
}
