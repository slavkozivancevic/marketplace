import { logger } from "@/lib/logger";
import { prisma } from "@/core/db/prisma";
import { stripe } from "@/services/stripe";
import {
  PaymentMethod,
  PaymentStatus,
  PaymentTransactionType,
  PaymentTransactionStatus,
} from "@/generated/prisma/client";
import { sellerNetAmount } from "../config";
import { MOCK_CONNECT, isMockAccount } from "../mock";
import { publishPayoutReleased } from "@/services/notifications";
import { recordAudit, SYSTEM_ACTOR } from "@/features/audit/db/audit";

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
 * Per-order refund context used to estimate how much of a seller's payout was
 * clawed back. Two very different signals feed it:
 *  - Org-scoped (app Return flow) refunds: exact - we know these are this
 *    seller's items, and settleReturnRefund already reversed the transfer.
 *  - Order-level (external/Stripe dashboard) refunds: NOT scoped to a seller.
 *    `fullyRefundedOrderIds` is populated from Order.paymentStatus, i.e. only
 *    once the refund covers the WHOLE order - that's the one case we know for
 *    certain every seller's payout was reversed (reverseSellerPayoutsForOrder
 *    runs exactly then). A partial external refund is netted through
 *    sellerNetAmount and capped at this seller's own payout, same as a return
 *    - an honest upper-bound estimate, never claiming money is gone that
 *    wasn't (see the 15.000/35.000 RSD case that motivated this).
 */
async function getPayoutRefundContext(
  organizationId: string,
  orderIds: string[],
): Promise<{
  orgRefundGross: Map<string, number>;
  externalRefundGross: Map<string, number>;
  fullyRefundedOrderIds: Set<string>;
}> {
  if (orderIds.length === 0) {
    return { orgRefundGross: new Map(), externalRefundGross: new Map(), fullyRefundedOrderIds: new Set() };
  }

  const [refunds, fullyRefundedOrders] = await Promise.all([
    prisma.paymentTransaction.findMany({
      where: {
        orderId: { in: orderIds },
        type: PaymentTransactionType.REFUND,
        status: PaymentTransactionStatus.SUCCEEDED,
      },
      select: { orderId: true, organizationId: true, amount: true },
    }),
    prisma.order.findMany({
      where: { id: { in: orderIds }, paymentStatus: PaymentStatus.REFUNDED },
      select: { id: true },
    }),
  ]);

  const orgRefundGross = new Map<string, number>();
  const externalRefundGross = new Map<string, number>();
  for (const r of refunds) {
    if (r.organizationId === organizationId) {
      orgRefundGross.set(r.orderId, (orgRefundGross.get(r.orderId) ?? 0) + r.amount);
    } else if (r.organizationId === null) {
      externalRefundGross.set(r.orderId, (externalRefundGross.get(r.orderId) ?? 0) + r.amount);
    }
  }

  return {
    orgRefundGross,
    externalRefundGross,
    fullyRefundedOrderIds: new Set(fullyRefundedOrders.map((o) => o.id)),
  };
}

function computeReversedNet(
  orderId: string,
  payoutAmount: number,
  ctx: Awaited<ReturnType<typeof getPayoutRefundContext>>,
): number {
  if (ctx.fullyRefundedOrderIds.has(orderId)) return payoutAmount;
  const netted =
    sellerNetAmount(ctx.orgRefundGross.get(orderId) ?? 0) +
    sellerNetAmount(ctx.externalRefundGross.get(orderId) ?? 0);
  return Math.min(payoutAmount, netted);
}

/**
 * Classifies every payout-bearing order for an org by how much of THIS org's
 * payout was clawed back: `full` (entire payout reversed) vs `partial` (some,
 * but not all). Orders with no reversal appear in neither set. Uses the exact
 * same math as the per-row classification in `getOrgPayoutsPage` so the filter
 * facet and the row badge always agree.
 *
 * Scoped through the order's own payout rows so the set stays small (refunds are
 * rare), letting the list filter by plain `orderId in / notIn` conditions that
 * compose with cursor pagination.
 */
async function getOrgPayoutRefundStates(
  organizationId: string,
): Promise<{ full: string[]; partial: string[] }> {
  // This org's payout per order (one row per (order, seller); aggregate to be safe).
  const payouts = await prisma.paymentTransaction.findMany({
    where: { organizationId, type: PaymentTransactionType.PAYOUT },
    select: { orderId: true, amount: true },
  });
  if (payouts.length === 0) return { full: [], partial: [] };
  const payoutAmount = new Map<string, number>();
  for (const p of payouts) {
    payoutAmount.set(p.orderId, (payoutAmount.get(p.orderId) ?? 0) + p.amount);
  }

  const ctx = await getPayoutRefundContext(organizationId, [...payoutAmount.keys()]);

  const full: string[] = [];
  const partial: string[] = [];
  for (const [orderId, amount] of payoutAmount) {
    const reversedNet = computeReversedNet(orderId, amount, ctx);
    if (reversedNet <= 0) continue;
    (reversedNet >= amount ? full : partial).push(orderId);
  }
  return { full, partial };
}

/**
 * Current COD commission balance an org owes the platform, one row per
 * currency it has accrued in (see OrgBalance). Zero-balance currencies are
 * omitted. Surfaced on the payouts page so the seller isn't surprised when a
 * future Stripe payout comes in lower than expected (see releaseSellerPayout).
 */
export async function getOrgCodBalances(
  organizationId: string,
): Promise<{ currency: string; owedAmount: number }[]> {
  const rows = await prisma.orgBalance.findMany({
    where: { organizationId, owedAmount: { gt: 0 } },
    select: { currency: true, owedAmount: true },
  });
  return rows;
}

export type AdminCodBalanceItem = {
  organizationId: string;
  organizationName: string;
  currency: string;
  owedAmount: number;
};

/**
 * Every organization with an outstanding COD commission balance, across all
 * currencies - the platform admin's settlement view. Expected to stay a small
 * list (debt only sits here between accrual and either a same-currency payout
 * netting it away or a manual settlement below), so no pagination.
 */
export async function getAllCodBalances(): Promise<AdminCodBalanceItem[]> {
  const rows = await prisma.orgBalance.findMany({
    where: { owedAmount: { gt: 0 } },
    orderBy: { owedAmount: "desc" },
    select: {
      organizationId: true,
      currency: true,
      owedAmount: true,
      organization: { select: { name: true } },
    },
  });
  return rows.map((r) => ({
    organizationId: r.organizationId,
    organizationName: r.organization.name,
    currency: r.currency,
    owedAmount: r.owedAmount,
  }));
}

/**
 * Manually settles (part of) an org's COD balance - for commission collected
 * outside the app (bank transfer, cash) that will never pass through a
 * same-currency Stripe payout to net against automatically (releaseSellerPayout).
 * Clamped to the current balance so an admin entering too high an amount
 * can't push it negative; returns the amount actually settled.
 */
export async function settleCodBalance({
  organizationId,
  currency,
  amount,
}: {
  organizationId: string;
  currency: string;
  amount: number;
}): Promise<number> {
  const balance = await prisma.orgBalance.findUnique({
    where: { organizationId_currency: { organizationId, currency } },
  });
  const settled = Math.max(0, Math.min(amount, balance?.owedAmount ?? 0));
  if (settled > 0) {
    await prisma.orgBalance.update({
      where: { organizationId_currency: { organizationId, currency } },
      data: { owedAmount: { decrement: settled } },
    });
  }
  return settled;
}

/**
 * This org's theoretical net payout per order (subtotal-based, pre-COD-
 * netting) - the same formula releaseSellerPayout uses to compute `net`
 * before withholding any COD commission owed. Comparing it against the
 * actual PAYOUT amount (see getOrgPayoutsPage) is how the list surfaces a
 * "withheld for COD debt" row without a dedicated ledger column.
 */
async function getTheoreticalNetByOrder(
  organizationId: string,
  orderIds: string[],
): Promise<Map<string, number>> {
  if (orderIds.length === 0) return new Map();
  const [items, orders] = await Promise.all([
    prisma.orderItem.findMany({
      where: { orderId: { in: orderIds }, product: { organizationId } },
      select: { orderId: true, price: true, quantity: true },
    }),
    prisma.order.findMany({
      where: { id: { in: orderIds } },
      select: { id: true, shippingByOrg: true },
    }),
  ]);
  const subtotalByOrder = new Map<string, number>();
  for (const it of items) {
    subtotalByOrder.set(it.orderId, (subtotalByOrder.get(it.orderId) ?? 0) + it.price * it.quantity);
  }
  const netByOrder = new Map<string, number>();
  for (const o of orders) {
    const subtotal = subtotalByOrder.get(o.id) ?? 0;
    const shippingByOrg = (o.shippingByOrg as Record<string, number> | null) ?? {};
    const shipping = shippingByOrg[organizationId] ?? 0;
    netByOrder.set(o.id, sellerNetAmount(subtotal) + shipping);
  }
  return netByOrder;
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

  // Refund facet: "full" / "partial" / "active" (not refunded). Only a proper
  // non-empty subset narrows - empty or all three selected means show everything.
  const refundedSel = refunded ?? [];
  let refundedCondition: { orderId?: object; OR?: object[] }[] = [];
  if (refundedSel.length > 0 && refundedSel.length < 3) {
    const { full, partial } = await getOrgPayoutRefundStates(organizationId);
    const refundedIds = [...full, ...partial];
    const inIds: string[] = [];
    if (refundedSel.includes("full")) inIds.push(...full);
    if (refundedSel.includes("partial")) inIds.push(...partial);
    const clauses: { orderId: object }[] = [];
    // "active" = not in any reversed order.
    if (refundedSel.includes("active")) clauses.push({ orderId: { notIn: refundedIds } });
    if (inIds.length > 0 || !refundedSel.includes("active")) {
      clauses.push({ orderId: { in: inIds } });
    }
    refundedCondition = clauses.length === 1 ? [clauses[0]] : [{ OR: clauses }];
  }

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

  // Per row, work out how much of the payout was clawed back so the UI can
  // tell a full reversal from a partial one - see getPayoutRefundContext.
  const orderIds = [...new Set(rows.map((r) => r.orderId))];
  const [ctx, theoreticalNetByOrder] = await Promise.all([
    getPayoutRefundContext(organizationId, orderIds),
    getTheoreticalNetByOrder(organizationId, orderIds),
  ]);

  return {
    items: rows.map((p) => {
      const reversedNet = computeReversedNet(p.orderId, p.amount, ctx);
      const refundState =
        reversedNet <= 0 ? "none" : reversedNet >= p.amount ? "full" : "partial";
      // Independent of refundState/reversedNet: netting happens once at ship
      // time (against COD debt), refunds happen later against whatever was
      // actually transferred - the two never overlap in what they explain.
      const theoreticalNet = theoreticalNetByOrder.get(p.orderId) ?? p.amount;
      const codNetted = Math.max(0, theoreticalNet - p.amount);
      return { ...p, refundState, reversedNet, codNetted };
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

  const [groups, refundStates] = await Promise.all([
    prisma.paymentTransaction.groupBy({
      by: ["status"],
      where: baseWhere,
      _count: { _all: true },
    }),
    getOrgPayoutRefundStates(organizationId),
  ]);

  const status: Record<string, number> = {};
  let total = 0;
  for (const g of groups) {
    status[g.status] = g._count._all;
    total += g._count._all;
  }

  // Count payout rows (respecting search) whose order falls in each reversal set.
  const [fullCount, partialCount] = await Promise.all([
    refundStates.full.length
      ? prisma.paymentTransaction.count({
          where: { ...baseWhere, orderId: { in: refundStates.full } },
        })
      : 0,
    refundStates.partial.length
      ? prisma.paymentTransaction.count({
          where: { ...baseWhere, orderId: { in: refundStates.partial } },
        })
      : 0,
  ]);

  return {
    status,
    refunded: {
      full: fullCount,
      partial: partialCount,
      active: total - fullCount - partialCount,
    },
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
 * Before transferring, nets any same-currency COD commission this org owes
 * (OrgBalance) against the transfer amount - the withheld slice just stays on
 * the platform's Stripe balance, settling the debt without a separate charge.
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
    select: { paymentMethod: true, currency: true, locale: true, shippingByOrg: true },
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
  // Delivery this seller charged the buyer goes to the seller in full (no
  // platform fee), on top of their net items share.
  const shippingByOrg = (order.shippingByOrg as Record<string, number> | null) ?? {};
  const orgShipping = shippingByOrg[organizationId] ?? 0;
  const net = sellerNetAmount(subtotal) + orgShipping;
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

  // Net any COD commission this org currently owes (same currency only - see
  // OrgBalance) against the real transfer about to happen. The netted slice
  // simply never leaves the platform's Stripe balance, which IS the
  // collection: no separate charge or transfer-back is needed. Only applied
  // here (not in the PENDING/not-onboarded branch above) since it must track
  // an actual transfer, never a marker for money that hasn't moved yet.
  const balance = await prisma.orgBalance.findUnique({
    where: { organizationId_currency: { organizationId, currency } },
  });
  const codNetted = Math.min(balance?.owedAmount ?? 0, net);
  const netAfterCod = net - codNetted;

  try {
    let providerId: string | null = null;
    if (netAfterCod > 0) {
      if (MOCK_CONNECT || isMockAccount(account.stripeAccountId)) {
        providerId = `tr_mock_${orderId}_${organizationId}`;
      } else {
        const transfer = await stripe.transfers.create({
          amount: netAfterCod,
          currency,
          destination: account.stripeAccountId,
          transfer_group: orderId,
          metadata: { orderId, organizationId },
        });
        providerId = transfer.id;
      }
    }
    // netAfterCod === 0 means the whole payout was absorbed by COD commission
    // owed - no transfer to make, but the ledger row + balance decrement below
    // still need to happen (once) so the debt is actually marked settled.

    await prisma.$transaction(async (tx) => {
      await tx.paymentTransaction.create({
        data: {
          orderId,
          organizationId,
          type: PaymentTransactionType.PAYOUT,
          status: PaymentTransactionStatus.SUCCEEDED,
          provider: PaymentMethod.STRIPE,
          providerId,
          amount: netAfterCod,
          currency,
          note:
            codNetted > 0
              ? `Netted ${codNetted} ${currency} against COD commission owed`
              : undefined,
        },
      });
      if (codNetted > 0) {
        await tx.orgBalance.update({
          where: { organizationId_currency: { organizationId, currency } },
          data: { owedAmount: { decrement: codNetted } },
        });
      }
    });

    // Tell the seller they've been paid (best-effort - must not fail the payout).
    publishPayoutReleased({
      orderId,
      organizationId,
      amount: netAfterCod,
      currency,
      locale: order.locale ?? "en",
      codNetted: codNetted > 0 ? codNetted : undefined,
    }).catch((e) => logger.error("[releaseSellerPayout] publishPayoutReleased failed", e));

    await recordAudit({
      action: "payout.released",
      entityType: "Order",
      entityId: orderId,
      diff: { seller: organizationId, amount: netAfterCod, currency, codNetted },
    });
  } catch (err) {
    logger.error("[releaseSellerPayout] transfer failed", organizationId, err);
    // Transfer failed before any netting was applied - the COD balance was
    // never touched, so the debt stays intact for the next attempt. Record
    // the amount actually attempted (post-netting), not the pre-netting net.
    await prisma.paymentTransaction.create({
      data: {
        orderId,
        organizationId,
        type: PaymentTransactionType.PAYOUT,
        status: PaymentTransactionStatus.FAILED,
        provider: PaymentMethod.STRIPE,
        amount: netAfterCod,
        currency,
        note: err instanceof Error ? err.message.slice(0, 500) : "transfer failed",
      },
    });
  }
}

/**
 * Claws back every seller's payout on an order once the WHOLE order is refunded
 * externally (a manual refund from the Stripe dashboard, via reconcileStripeRefund).
 * The buyer side of that refund is already recorded; without this the seller
 * simply keeps the money for an order the platform just refunded in full. Mirrors
 * the per-item reversal settleReturnRefund does for app-initiated returns, but
 * reverses the whole transfer since the whole order (not one seller's slice) was
 * refunded. Best-effort per seller - one failed reversal must not block the rest,
 * and is logged + audited so it can be chased manually.
 */
export async function reverseSellerPayoutsForOrder(orderId: string): Promise<void> {
  const payouts = await prisma.paymentTransaction.findMany({
    where: {
      orderId,
      type: PaymentTransactionType.PAYOUT,
      status: PaymentTransactionStatus.SUCCEEDED,
    },
    select: { organizationId: true, amount: true, providerId: true },
  });

  for (const payout of payouts) {
    if (!payout.providerId || MOCK_CONNECT || payout.providerId.startsWith("tr_mock_")) {
      continue;
    }
    try {
      await stripe.transfers.createReversal(payout.providerId, { amount: payout.amount });
      await recordAudit({
        action: "payout.reversed",
        entityType: "Order",
        entityId: orderId,
        diff: { seller: payout.organizationId, amount: payout.amount, reason: "external_refund" },
        actor: SYSTEM_ACTOR,
      });
    } catch (err) {
      logger.error(
        "[reverseSellerPayoutsForOrder] transfer reversal failed",
        payout.organizationId,
        err,
      );
      await recordAudit({
        action: "payout.reversal_failed",
        entityType: "Order",
        entityId: orderId,
        diff: {
          seller: payout.organizationId,
          amount: payout.amount,
          error: err instanceof Error ? err.message.slice(0, 500) : "transfer reversal failed",
        },
        actor: SYSTEM_ACTOR,
      });
    }
  }
}
