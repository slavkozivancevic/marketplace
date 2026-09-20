import { prisma } from "@/core/db/prisma";
import {
  Prisma,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  ReturnStatus,
  PaymentTransactionType,
} from "@/generated/prisma/client";
import { sellerNetAmount } from "@/features/payments/config";
import { codCommissionBack } from "@/features/orders/db/sellerParts";

/**
 * Order-level conditions that select the orders where THIS seller's part sits at
 * a given stage. The seller list filters on what the seller sees, which is its
 * own part's stage (`deriveSellerPartStage`), not the whole order's.
 *
 * Every clause narrows through `sellerParts.some({ organizationId, ... })`.
 * "Some" is exact here rather than loose: `@@unique([orderId, organizationId])`
 * means a seller has at most one part per order, so several `some` clauses in
 * one AND all describe that same single row.
 */
/**
 * Orders where THIS seller's own goods have all come back.
 *
 * Kept as a set of ids rather than a SQL predicate for the same reason
 * `getOrgPayoutRefundStates` does it: the comparison is a sum of this org's
 * REFUND rows against its part's goods, which no `where` clause can express -
 * but refunds are rare, so the set stays small and composes with cursor
 * pagination as a plain `id in / notIn`.
 *
 * An order refunded in FULL is not in here and does not need to be: that is a
 * fact about the order, so `sellerStageCondition` reads it straight off the
 * payment axis.
 */
async function getOrgFullyRefundedOrderIds(organizationId: string): Promise<string[]> {
  const refunds = await prisma.paymentTransaction.findMany({
    where: { organizationId, type: PaymentTransactionType.REFUND },
    select: { orderId: true, amount: true },
  });
  if (refunds.length === 0) return [];

  const grossByOrder = new Map<string, number>();
  for (const r of refunds) {
    grossByOrder.set(r.orderId, (grossByOrder.get(r.orderId) ?? 0) + r.amount);
  }

  const parts = await prisma.orderSellerPart.findMany({
    where: { organizationId, orderId: { in: [...grossByOrder.keys()] } },
    select: { orderId: true, itemsSubtotal: true },
  });

  return parts
    .filter((part) => (grossByOrder.get(part.orderId) ?? 0) >= part.itemsSubtotal)
    .map((part) => part.orderId);
}

/** Every stage the seller's sidebar counts, and the order they are counted in. */
const SELLER_STAGES = [
  OrderStatus.PENDING,
  OrderStatus.PROCESSING,
  OrderStatus.SHIPPED,
  OrderStatus.DELIVERED,
  OrderStatus.COMPLETED,
  OrderStatus.CANCELLED,
  OrderStatus.REFUNDED,
] as const;

function sellerStageCondition(
  stage: string,
  organizationId: string,
  orgFullyRefundedIds: string[],
): Prisma.OrderWhereInput | null {
  const mine = (where: Prisma.OrderSellerPartWhereInput): Prisma.OrderWhereInput => ({
    sellerParts: { some: { organizationId, ...where } },
  });
  const active = mine({ cancelledAt: null });
  // Refunded FOR THIS SELLER: the order was written off whole, or every unit of
  // this seller's own goods came back. The second half is why the id set exists
  // - an order can be only PARTIALLY_REFUNDED overall while one seller in it has
  // nothing left, and that seller belongs under "Refunded", not "Completed".
  const refundedForOrg: Prisma.OrderWhereInput = {
    OR: [{ paymentStatus: PaymentStatus.REFUNDED }, { id: { in: orgFullyRefundedIds } }],
  };
  const notRefunded: Prisma.OrderWhereInput = {
    AND: [
      { paymentStatus: { not: PaymentStatus.REFUNDED } },
      { id: { notIn: orgFullyRefundedIds } },
    ],
  };

  // COD cash is this seller's own; card money is captured for the whole order.
  const paid: Prisma.OrderWhereInput = {
    OR: [
      { paymentMethod: PaymentMethod.COD, ...mine({ codSettledAt: { not: null } }) },
      {
        paymentMethod: PaymentMethod.STRIPE,
        paymentStatus: { in: [PaymentStatus.PAID, PaymentStatus.PARTIALLY_REFUNDED] },
      },
    ],
  };
  const unpaid: Prisma.OrderWhereInput = {
    OR: [
      { paymentMethod: PaymentMethod.COD, ...mine({ codSettledAt: null }) },
      { paymentMethod: PaymentMethod.STRIPE, paymentStatus: PaymentStatus.UNPAID },
    ],
  };

  switch (stage) {
    case OrderStatus.CANCELLED:
      return mine({ cancelledAt: { not: null } });
    case OrderStatus.REFUNDED:
      return { AND: [refundedForOrg, active] };
    case OrderStatus.COMPLETED:
      return { AND: [notRefunded, mine({ cancelledAt: null, deliveredAt: { not: null } }), paid] };
    case OrderStatus.DELIVERED:
      return { AND: [notRefunded, mine({ cancelledAt: null, deliveredAt: { not: null } }), unpaid] };
    case OrderStatus.SHIPPED:
      return {
        AND: [
          notRefunded,
          mine({ cancelledAt: null, shippedAt: { not: null }, deliveredAt: null }),
        ],
      };
    case OrderStatus.PROCESSING:
      return { AND: [notRefunded, mine({ cancelledAt: null, shippedAt: null }), paid] };
    case OrderStatus.PENDING:
      return { AND: [notRefunded, mine({ cancelledAt: null, shippedAt: null }), unpaid] };
    default:
      // Legacy values (PENDING_COD, AWAITING_PAYMENT) are never derived any more.
      return null;
  }
}

// ─── List ─────────────────────────────────────────────────────────────────────

export async function getOrgOrdersPage({
  organizationId,
  take,
  cursor,
  search,
  status,
  sortBy = "createdAt",
  sortOrder = "desc",
}: {
  organizationId: string;
  take: number;
  cursor?: string;
  search?: string;
  status?: string[];
  sortBy?: "createdAt" | "total";
  sortOrder?: "asc" | "desc";
}) {
  // Build conditions separately to avoid Prisma recursive-type circular reference
  const orgCondition = { items: { some: { product: { organizationId } } } };

  const searchConditions = search
    ? [
        {
          OR: [
            { id: { contains: search, mode: "insensitive" as const } },
            { user: { name: { contains: search, mode: "insensitive" as const } } },
            {
              items: {
                some: {
                  product: {
                    organizationId,
                    translations: {
                      some: { title: { contains: search, mode: "insensitive" as const } },
                    },
                  },
                },
              },
            },
          ],
        },
      ]
    : [];

  // Filter on the stage the SELLER sees. A seller that withdrew from an order
  // must find it under "Cancelled" even though the order itself lives on.
  const orgFullyRefundedIds =
    (status ?? []).length > 0 ? await getOrgFullyRefundedOrderIds(organizationId) : [];
  const stageConditions = (status ?? [])
    .map((s) => sellerStageCondition(s, organizationId, orgFullyRefundedIds))
    .filter((c): c is Prisma.OrderWhereInput => c !== null);
  const statusCondition = stageConditions.length > 0 ? [{ OR: stageConditions }] : [];

  const sortField: Prisma.OrderOrderByWithRelationInput =
    sortBy === "createdAt" ? { createdAt: sortOrder } : { total: sortOrder };

  const rows = await prisma.order.findMany({
    where: {
      AND: [orgCondition, ...searchConditions, ...statusCondition],
    },
    orderBy: [sortField, { id: "asc" }],
    take: take + 1,
    cursor: cursor ? { id: cursor } : undefined,
    skip: cursor ? 1 : 0,
    // The order's grand total is partly other sellers' money in a multi-seller
    // order, so it is never loaded into a seller-facing payload. `orgSubtotal`
    // below is this seller's own figure, and is what the row renders. Sorting by
    // it still works - orderBy does not need the column selected.
    omit: { total: true },
    include: {
      items: {
        where: { product: { organizationId } },
        // Deterministic item order so the "Items" column is stable across
        // reloads and matches the buyer orders list (which sorts the same way).
        orderBy: { id: "asc" },
        include: {
          product: {
            select: {
              id: true,
              translations: { select: { locale: true, title: true } },
            },
          },
          variant: {
            select: {
              sku: true,
              // The row names the variant the way every other surface does -
              // the option labels, with the SKU only as a last resort when a
              // variant has no options to name it by.
              attributeValues: {
                select: {
                  option: { select: { translations: { select: { locale: true, label: true } } } },
                },
              },
            },
          },
        },
      },
      user: { select: { name: true } },
      // This seller's own part - drives the row's status badge.
      sellerParts: {
        where: { organizationId },
        select: {
          shippedAt: true,
          deliveredAt: true,
          cancelledAt: true,
          codSettledAt: true,
          // The bar the row's refund badge is measured against.
          itemsSubtotal: true,
        },
      },
    },
  });

  let nextCursor: string | undefined;
  if (rows.length > take) {
    nextCursor = rows.pop()!.id;
  }

  // Flag orders with an in-flight return for THIS org (REQUESTED/APPROVED/
  // SHIPPED) so the seller list can show a "return in progress" hint.
  const pageOrderIds = rows.map((o) => o.id);
  const activeReturns = pageOrderIds.length
    ? await prisma.return.findMany({
        where: {
          orderId: { in: pageOrderIds },
          organizationId,
          status: {
            in: [ReturnStatus.REQUESTED, ReturnStatus.APPROVED, ReturnStatus.SHIPPED],
          },
        },
        select: { orderId: true },
      })
    : [];
  const ordersWithActiveReturn = new Set(activeReturns.map((r) => r.orderId));

  // What THIS seller has had refunded on each of these orders. The row's refund
  // badge is about the seller's own goods, never the order's payment axis - in a
  // multi-seller order that axis carries other sellers' refunds, and it was
  // marking a seller "partially refunded" over goods that were never theirs.
  const orgRefunds = pageOrderIds.length
    ? await prisma.paymentTransaction.groupBy({
        by: ["orderId"],
        where: {
          orderId: { in: pageOrderIds },
          organizationId,
          type: PaymentTransactionType.REFUND,
        },
        _sum: { amount: true },
      })
    : [];
  const refundedGrossByOrder = new Map(
    orgRefunds.map((r) => [r.orderId, r._sum.amount ?? 0]),
  );

  return {
    items: rows.map(({ sellerParts, ...order }) => ({
      ...order,
      exchangeRate: order.exchangeRate != null ? Number(order.exchangeRate) : null,
      hasActiveReturn: ordersWithActiveReturn.has(order.id),
      orgRefundedGross: refundedGrossByOrder.get(order.id) ?? 0,
      // At most one part per (order, seller) - see the unique constraint.
      sellerPart: sellerParts[0] ?? null,
      orgSubtotal: order.items.reduce(
        (sum, item) => sum + Number(item.price) * item.quantity,
        0,
      ),
      items: order.items.map((item) => ({
        ...item,
        price: Number(item.price),
      })),
    })),
    nextCursor,
  };
}

export type OrgOrderListItem = Awaited<
  ReturnType<typeof getOrgOrdersPage>
>["items"][number];

/**
 * Disjunctive status counts for the org order list sidebar. Ignores the status
 * selection itself (so every status stays countable while one is checked) but
 * applies the active search and the org scope, matching the list query.
 */
export async function getOrgOrderStatusCounts({
  organizationId,
  search,
}: {
  organizationId: string;
  search?: string;
}): Promise<Record<string, number>> {
  const orgCondition = { items: { some: { product: { organizationId } } } };

  const searchConditions = search
    ? [
        {
          OR: [
            { id: { contains: search, mode: "insensitive" as const } },
            { user: { name: { contains: search, mode: "insensitive" as const } } },
            {
              items: {
                some: {
                  product: {
                    organizationId,
                    translations: {
                      some: { title: { contains: search, mode: "insensitive" as const } },
                    },
                  },
                },
              },
            },
          ],
        },
      ]
    : [];

  // Counted through the SAME conditions the list filters by, one bounded count
  // per stage. Not a SQL groupBy on Order.status - the seller's stage is its
  // part's, so that would contradict the badges next to it - and no longer a
  // findMany tallied in JS either: that loaded every order the org had ever had,
  // with its part, on every keystroke of the search box. Sharing the conditions
  // is also what keeps a facet's number and what clicking it returns identical.
  const orgFullyRefundedIds = await getOrgFullyRefundedOrderIds(organizationId);

  const counted = await Promise.all(
    SELLER_STAGES.map(async (stage) => {
      const condition = sellerStageCondition(stage, organizationId, orgFullyRefundedIds);
      if (!condition) return [stage, 0] as const;
      const count = await prisma.order.count({
        where: { AND: [orgCondition, ...searchConditions, condition] },
      });
      return [stage, count] as const;
    }),
  );

  // Only the stages that actually occur, as the JS tally before it returned -
  // the sidebar renders a fixed list and defaults the rest to zero, and keeping
  // the shape lets a test say "this stage, and nothing else".
  return Object.fromEntries(counted.filter(([, count]) => count > 0));
}

// ─── Detail ───────────────────────────────────────────────────────────────────

export async function getOrgOrderById(orderId: string, organizationId: string) {
  const order = await prisma.order.findFirst({
    where: {
      id: orderId,
      AND: [{ items: { some: { product: { organizationId } } } }],
    },
    // Same rule as the list: the order's grand total is partly other sellers'
    // money, so it never reaches a seller-facing payload. The page builds its
    // breakdown from `orgSubtotal` below.
    omit: { total: true },
    include: {
      items: {
        where: { product: { organizationId } },
        include: {
          product: {
            select: {
              id: true,
              translations: { select: { locale: true, title: true } },
              media: {
                orderBy: { order: "asc" },
                take: 1,
                where: { mediaType: "IMAGE" },
              },
            },
          },
          variant: {
            select: {
              sku: true,
              attributeValues: {
                // Pull each axis option's per-locale label so the order page can
                // localize the variant label (controlled attribute vocabulary).
                select: {
                  option: {
                    select: {
                      value: true,
                      translations: { select: { locale: true, label: true } },
                    },
                  },
                },
              },
              media: {
                orderBy: { order: "asc" },
                take: 1,
                select: { media: { select: { url: true, thumbUrl: true, mediaType: true } } },
              },
            },
          },
        },
      },
      user: { select: { name: true, email: true } },
      // This seller's own part. Its coupon share is what makes the COD
      // commission credit below exact - the commission was accrued net of that
      // share, so anything given back has to be net of it too.
      sellerParts: {
        where: { organizationId },
        select: { itemsSubtotal: true, discountShare: true },
      },
      paymentTransactions: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          type: true,
          status: true,
          provider: true,
          amount: true,
          currency: true,
          createdAt: true,
          organizationId: true,
        },
      },
    },
  });

  if (!order) return null;

  // Annotate this org's PAYOUT/FEE row(s) with how much was clawed back by
  // refunds, mirroring the payouts table (see getPayoutRefundContext in
  // payments/db/payouts.ts - same math, kept in sync by hand since this query
  // already has the transactions loaded).
  //
  // Two very different signals feed this: org-scoped (app Return flow)
  // refunds are exact - we know these are this seller's items. Order-level
  // (manual/external Stripe dashboard) refunds are NOT scoped to a seller, so
  // only trust "the whole payout is gone" once the order is actually fully
  // refunded (order.paymentStatus REFUNDED - exactly when
  // reverseSellerPayoutsForOrder runs). A partial external refund is netted
  // through sellerNetAmount/platformFeeAmount and capped at this row's own
  // amount - an honest upper-bound estimate, never claiming money is gone
  // that wasn't.
  // Loaded unscoped because the refund maths below needs the order-level rows,
  // but NOT all of it may be handed back - see the filter under `visibleTxns`.
  const txns = order.paymentTransactions;
  const orgRefundGross = txns
    .filter((t) => t.type === PaymentTransactionType.REFUND && t.organizationId === organizationId)
    .reduce((sum, t) => sum + t.amount, 0);
  const externalRefundGross = txns
    .filter((t) => t.type === PaymentTransactionType.REFUND && t.organizationId === null)
    .reduce((sum, t) => sum + t.amount, 0);
  const isFullyRefunded = order.paymentStatus === PaymentStatus.REFUNDED;

  // A seller's ledger shows money movements that involve that seller, and
  // nothing else. Carts are multi-seller, so the unscoped list handed one seller
  // its competitors' PAYOUT and FEE amounts - their net revenue on the order -
  // along with a CHARGE covering everyone's goods. Kept here: this org's own
  // rows, plus order-level REFUNDs, which are not attributed to a seller yet do
  // claw back this one's payout, so it is owed the explanation.
  const visibleTxns = txns.filter(
    (t) =>
      t.organizationId === organizationId ||
      (t.organizationId === null && t.type === PaymentTransactionType.REFUND),
  );

  const orgPart = order.sellerParts[0] ?? null;

  const paymentTransactions = visibleTxns.map((t) => {
    // PAYOUT (seller net) and FEE (platform commission) are both clawed back /
    // credited proportionally when this org's items are refunded. A PAYOUT
    // reverses sellerNetAmount(refundedGross); a FEE credits what
    // settleReturnRefund actually took off the balance.
    const isPayout = t.type === PaymentTransactionType.PAYOUT && t.organizationId === organizationId;
    const isFee = t.type === PaymentTransactionType.FEE && t.organizationId === organizationId;
    if (!isPayout && !isFee) {
      return { ...t, refundState: "none" as const, reversedNet: 0 };
    }
    // A FEE was accrued NET of the coupon slice the platform funds
    // (markCodPaymentReceived), so the credit that comes back is net of it too -
    // `codCommissionBack`, the same call the refund itself books. Reading the
    // gross commission here instead overstated the credit by that slice: on
    // goods of 1000 with a 30 coupon and a 100 commission, returning half gives
    // the seller 35 back and the row claimed 50.
    //
    // Refunds made outside the app are left out of both. Nothing is reversed for
    // them until the order goes fully REFUNDED, and the branch below hands back
    // the whole row in that case anyway - so counting a partial one marked these
    // rows "partially refunded" while every cent of them still stood.
    const grossBack = isPayout
      ? sellerNetAmount(orgRefundGross)
      : codCommissionBack(0, orgRefundGross, orgPart);
    // A FEE can be negative - the platform owing the seller for a coupon deeper
    // than its commission - and then the credit coming back is negative too:
    // that debt shrinking, not growing. Clamp toward zero on whichever side the
    // row sits, so a reversal can never overshoot the row it belongs to or flip
    // its sign.
    const capped =
      t.amount >= 0
        ? Math.min(t.amount, Math.max(0, grossBack))
        : Math.max(t.amount, Math.min(0, grossBack));
    const reversedNet = isFullyRefunded ? t.amount : capped;
    const refundState =
      reversedNet === 0
        ? ("none" as const)
        : Math.abs(reversedNet) >= Math.abs(t.amount)
          ? ("full" as const)
          : ("partial" as const);
    return { ...t, refundState, reversedNet };
  });

  return {
    ...order,
    paymentTransactions,
    // Raw refund gross feeding the payout breakdown below - exposed separately
    // from paymentTransactions because COD orders never get a PAYOUT row (no
    // platform-held funds to reverse), so the page can't derive this from a
    // per-transaction reversedNet the way it does for the ledger display.
    orgRefundGross,
    externalRefundGross,
    isFullyRefunded,
    exchangeRate: order.exchangeRate != null ? Number(order.exchangeRate) : null,
    orgSubtotal: order.items.reduce(
      (sum, item) => sum + Number(item.price) * item.quantity,
      0,
    ),
    items: order.items.map((item) => ({
      ...item,
      price: Number(item.price),
    })),
  };
}

export type OrgOrderDetail = NonNullable<
  Awaited<ReturnType<typeof getOrgOrderById>>
>;