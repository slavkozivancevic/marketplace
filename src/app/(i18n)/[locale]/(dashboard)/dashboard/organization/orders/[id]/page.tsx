import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { Link, getPathname } from "@/i18n/navigation";
import { RetryImage } from "@/components/RetryImage";
import { getTranslations, getLocale } from "next-intl/server";
import { MapPin, Mail, Truck, CreditCard, RotateCcw, Info } from "lucide-react";
import { resolveRequestContext } from "@/lib/auth/resolveRequestContext";
import { requirePermission } from "@/lib/auth/permissions";
import { getOrgOrderById } from "@/features/orders/db/orgOrders";
import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { OrgOrderStatusManager } from "@/features/orders/components/OrgOrderStatusManager";
import { getOrgOrderReturns } from "@/features/returns/db/returns";
import { SellerReturns } from "@/features/returns/components/SellerReturns";
import { getOrgShipment } from "@/features/shipments/db/shipments";
import { ShipmentManager } from "@/features/shipments/components/ShipmentManager";
import { deriveSellerPartStage, sellerPartRefundState } from "@/features/orders/status";
import { orderStatusKey, orderStatusVariant } from "@/features/orders/statusBadge";
import { MembershipRole } from "@/generated/prisma/client";
import { dateLocale } from "@/lib/i18n/dateLocale";
import { formatPrice } from "@/lib/currency";
import { platformFeeAmount, PLATFORM_FEE_PERCENT } from "@/features/payments/config";
import { sellerOrderMoney } from "@/features/orders/sellerOrderMoney";
import type { Currency } from "@/lib/currency-config";
import { getVariantLabel } from "@/features/attributes/utils/translations";
import { getProductTitle } from "@/features/products/utils/translations";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function OrgOrderDetailPage({ params }: Props) {
  await connection();
  const t = await getTranslations("orgOrders");
  const tCrumbs = await getTranslations("breadcrumbs");
  const locale = await getLocale();
  const dl = dateLocale(locale);
  const { id } = await params;

  let ctx;
  try {
    ctx = await resolveRequestContext();
  } catch {
    notFound();
  }

  try {
    requirePermission(ctx, "order:read");
  } catch {
    // New active org doesn't grant access here - back to the dashboard.
    redirect(`/${locale}/dashboard`);
  }

  // Scoped to the active org: after an org switch this order belongs to the
  // previous org and won't be found here, so fall back to the dashboard rather
  // than a dead-end 404.
  const order = await getOrgOrderById(id, ctx.organizationId);
  if (!order) redirect(`/${locale}/dashboard`);

  const rawReturns = await getOrgOrderReturns(order.id, ctx.organizationId);
  // This seller's own part of the order. Everything on this page is about that
  // part - another seller's progress on the same order is none of its business.
  const part = await getOrgShipment(order.id, ctx.organizationId);
  if (!part) redirect(`/${locale}/dashboard`);

  // Display stage is derived from the real axes, so legacy rows (whose stored
  // status predates them) still render correctly. The refund half is scoped to
  // this seller's own goods - the order's payment axis carries every seller's
  // refunds, and reading it here told a seller with nothing returned that they
  // were partially refunded.
  const orgRefund = {
    refundedGross: order.orgRefundGross,
    itemsSubtotal: part.itemsSubtotal,
  };
  const refundState = sellerPartRefundState(orgRefund, order.paymentStatus);
  const displayStatus = deriveSellerPartStage({
    part,
    paymentMethod: order.paymentMethod,
    orderPaymentStatus: order.paymentStatus,
    orgRefund,
  });
  const isTerminal = part.cancelledAt != null || order.paymentStatus === "REFUNDED";
  // `cancelOrder` refuses anything that is not UNPAID, so a cancelled part was
  // never collected and never paid out: the breakdown below must not present
  // its figures as money on the way.
  const isCancelled = part.cancelledAt != null;

  // Attach localized titles to each return's lines (the order already carries
  // this seller's items with translations).
  const itemInfo = new Map(
    order.items.map((it) => {
      // `getProductTitle` (not a raw `find(locale)?.title ?? ...`) - a locale
      // can HAVE a translation row whose title was left blank, and `??` would
      // then hand back that empty string instead of falling back to English.
      const title = getProductTitle(it.product, order.locale);
      const variantLabel = getVariantLabel(it.variant, order.locale);
      return [it.id, { title, variantLabel }] as const;
    }),
  );
  const returns = rawReturns.map((r) => ({
    ...r,
    items: r.items.map((ri) => {
      const info = itemInfo.get(ri.orderItemId);
      return {
        orderItemId: ri.orderItemId,
        title: info?.title ?? "",
        variantLabel: info?.variantLabel ?? null,
        quantity: ri.quantity,
      };
    }),
  }));

  const hasActiveReturn = returns.some((r) =>
    ["REQUESTED", "APPROVED", "SHIPPED"].includes(r.status),
  );

  const canManage =
    ctx.membershipRole === MembershipRole.OWNER ||
    ctx.membershipRole === MembershipRole.ADMIN;

  // Delivery this seller charged goes to them in full (no platform fee), on top
  // of their net items share.
  const orgShipping =
    (order.shippingByOrg as Record<string, number> | null)?.[ctx.organizationId] ?? 0;
  const isCod = order.paymentMethod === "COD";
  // A succeeded Stripe transfer for this order may have been reduced below the
  // payout to net this org's COD commission balance against it - the breakdown
  // needs the amount that actually moved, not the one that was owed.
  const orgPayoutTx = order.paymentTransactions.find(
    (tx) => tx.type === "PAYOUT" && tx.organizationId === ctx.organizationId && tx.status === "SUCCEEDED",
  );
  const {
    externalRefundPending,
    orgPayout,
    codCashToCollect,
    codCommissionCredited,
    codOwedAfterRefunds,
    payoutReversed,
    codNetted,
    payoutReversedFromTransfer,
    codDebtRestored,
    finalTransferred,
  } = sellerOrderMoney({
    isCod,
    isCancelled,
    isFullyRefunded: order.isFullyRefunded,
    orgSubtotal: order.orgSubtotal,
    orgShipping,
    partShipping: part.shippingAmount,
    part,
    orgRefundGross: order.orgRefundGross,
    externalRefundGross: order.externalRefundGross,
    payoutTxAmount: orgPayoutTx?.amount ?? null,
  });

  const shortId = `#${order.id.slice(-8).toUpperCase()}`;
  const breadcrumbItems = [
    { name: tCrumbs("dashboard"), href: getPathname({ href: "/dashboard", locale }) },
    { name: tCrumbs("receivedOrders"), href: getPathname({ href: "/dashboard/organization/orders", locale }) },
    {
      name: `${tCrumbs("orderDetails")} ${shortId}`,
      href: getPathname({ href: { pathname: "/dashboard/organization/orders/[id]", params: { id } }, locale }),
    },
  ];

  const txTypeLabel: Record<string, string> = {
    CHARGE: t("txType.charge"),
    REFUND: t("txType.refund"),
    PAYOUT: t("txType.payout"),
    FEE: t("txType.fee"),
  };
  const txStatusLabel: Record<string, string> = {
    PENDING: t("txStatus.pending"),
    SUCCEEDED: t("txStatus.succeeded"),
    FAILED: t("txStatus.failed"),
  };
  const txStatusVariant = (s: string) =>
    s === "SUCCEEDED" ? ("default" as const)
    : s === "FAILED" ? ("destructive" as const)
    : ("secondary" as const);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="shrink-0 px-6 pt-2 sticky-header-bg">
        <Breadcrumbs items={breadcrumbItems} seo={false} />
        <PageHeader
          title={`${t("orderDetail")} ${shortId}`}
          description={t("placedOn", {
            date: new Date(order.createdAt).toLocaleDateString(dl, {
              year: "numeric",
              month: "long",
              day: "numeric",
            }),
          })}
        >
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard/organization/orders">{t("backToOrders")}</Link>
          </Button>
        </PageHeader>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 px-6 pb-6">
        <div className="max-w-2xl space-y-5">

          {/* Members can read received orders but not act on them - flag it up
              front (a top banner, matching the my-products read-only notice)
              instead of silently dropping every management control below. */}
          {!canManage && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>{t("readOnly")}</AlertTitle>
              <AlertDescription>{t("viewOnly")}</AlertDescription>
            </Alert>
          )}

          {/* ── Order summary ── */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base">{t("orderSummary")}</CardTitle>
              <div className="flex items-center gap-2">
                {order.paymentMethod === "COD" ? (
                  <Badge variant="outline" className="gap-1 text-xs">
                    <Truck className="h-3 w-3" />
                    {t("cashOnDelivery")}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="gap-1 text-xs">
                    <CreditCard className="h-3 w-3" />
                    {t("card")}
                  </Badge>
                )}
                {hasActiveReturn && (
                  <Badge variant="outline" className="gap-1 text-xs" title={t("returnInProgress")}>
                    <RotateCcw className="h-3 w-3" />
                    {t("returnInProgress")}
                  </Badge>
                )}
                {refundState === "partial" && (
                  <Badge variant="outline" className="gap-1 text-xs text-steel border-steel/40">
                    {t("partiallyRefunded")}
                  </Badge>
                )}
                <Badge variant={orderStatusVariant(displayStatus)}>
                  {t(orderStatusKey(displayStatus))}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="text-sm space-y-1.5">
              <div className="flex justify-between text-muted-foreground">
                <span>{t("orderId")}</span>
                <span className="font-mono">{shortId}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>{t("date")}</span>
                <span>
                  {new Date(order.createdAt).toLocaleString(dl, {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              {order.discountAmount > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>{t("coupon")}</span>
                  <Badge variant="secondary" className="font-mono text-[10px]">
                    {order.couponCode}
                  </Badge>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Action required (deliver / collect cash / cancel) ──
              Driven by this seller's own part: it collects its own cash and
              cancels its own goods, never the whole order's.

              Deliberately NOT gated on `isTerminal`: cancelling is what makes the
              part terminal, so gating here would unmount the card in the middle
              of its own action and take the pending confirmation toast with it.
              The card is handed the cancelled flag and renders nothing itself. */}
          {canManage && (
            <OrgOrderStatusManager
              orderId={order.id}
              paymentMethod={order.paymentMethod}
              partDelivered={part.deliveredAt != null}
              partSettled={part.codSettledAt != null}
              partCancelled={part.cancelledAt != null}
              orderPaymentStatus={order.paymentStatus}
            />
          )}

          {/* ── Fulfillment / shipping ── */}
          {canManage && !isTerminal && (
            <ShipmentManager orderId={order.id} shipment={part} />
          )}

          {/* ── Returns (RMA) ── */}
          {canManage && <SellerReturns returns={returns} currency={order.currency} />}

          {/* ── Payment history (ledger) ── */}
          {order.paymentTransactions.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  {t("paymentHistory")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-0 text-sm">
                {order.paymentTransactions.map((tx, index) => (
                  <div key={tx.id}>
                    {index > 0 && <Separator className="my-3" />}
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={tx.type === "REFUND" ? "destructive" : "secondary"}
                            className="text-[10px]"
                          >
                            {/* A negative FEE is the opposite transaction - the
                                platform paying the seller back for a COD coupon
                                - so it must not wear the word "commission". */}
                            {tx.type === "FEE" && tx.amount < 0
                              ? t("txType.feeCredit")
                              : (txTypeLabel[tx.type] ?? tx.type)}
                          </Badge>
                          <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                            {tx.provider === "COD" ? (
                              <><Truck className="h-3 w-3" />{t("cashOnDelivery")}</>
                            ) : (
                              <><CreditCard className="h-3 w-3" />{t("card")}</>
                            )}
                          </span>
                          {/* A PAYOUT was clawed back BECAUSE of a refund, so
                              that is what its badge says. A FEE is the platform's
                              own bookkeeping against this seller - a commission
                              owed, or a coupon credit owed back to them - and
                              nothing is refunded to anybody when it unwinds: the
                              entry is voided. "Refundirano" struck across a
                              credit row read as if the seller's money had gone
                              somewhere, when the row simply stopped standing. */}
                          {(tx.type === "PAYOUT" || tx.type === "FEE") && tx.refundState === "full" && (
                            <Badge variant="destructive" className="text-[10px]">
                              {tx.type === "FEE" ? t("feeVoided") : t("refunded")}
                            </Badge>
                          )}
                          {(tx.type === "PAYOUT" || tx.type === "FEE") && tx.refundState === "partial" && (
                            <Badge variant="outline" className="text-[10px]">
                              {tx.type === "FEE" ? t("feePartlyVoided") : t("partiallyRefunded")}
                            </Badge>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {new Date(tx.createdAt).toLocaleString(dl, {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      <div className="flex flex-col items-end gap-0.5">
                        {/* A FEE row is money leaving the seller, so it is
                            rendered with a minus and in red - EXCEPT when it is
                            negative, which is the platform owing them for a COD
                            coupon deeper than its commission
                            (markCodPaymentReceived). Printing the stored sign
                            under the same rule gave "--400,01" in red, which
                            reads as a charge twice over rather than as money
                            coming back. */}
                        <span
                          className={`font-semibold tabular-nums ${
                            (tx.type === "PAYOUT" || tx.type === "FEE") && tx.refundState === "full"
                              ? "text-muted-foreground line-through"
                              : tx.type === "FEE" && tx.amount < 0
                                ? "text-emerald-600 dark:text-emerald-500"
                                : tx.type === "REFUND" || tx.type === "FEE"
                                  ? "text-destructive"
                                  : ""
                          }`}
                        >
                          {tx.type === "FEE" && tx.amount < 0
                            ? "+"
                            : tx.type === "REFUND" || tx.type === "FEE"
                              ? "-"
                              : ""}
                          {formatPrice(Math.abs(tx.amount), tx.currency as Currency, locale)}
                        </span>
                        {tx.type === "PAYOUT" && tx.refundState === "partial" && (
                          <span className="text-[11px] text-destructive tabular-nums">
                            -{formatPrice(tx.reversedNet, tx.currency as Currency, locale)}
                          </span>
                        )}
                        {/* Which way this credit points follows the row it
                            belongs to: a commission owed gets money back (green
                            plus), while a credit the platform owed the seller
                            SHRINKS when their goods come back (red minus). One
                            hard-coded plus read as a gift in the second case. */}
                        {tx.type === "FEE" && tx.refundState === "partial" && (
                          <span
                            className={`text-[11px] tabular-nums ${
                              tx.amount < 0 ? "text-destructive" : "text-emerald-600"
                            }`}
                          >
                            {tx.amount < 0 ? "-" : "+"}
                            {formatPrice(Math.abs(tx.reversedNet), tx.currency as Currency, locale)}
                          </span>
                        )}
                        <Badge variant={txStatusVariant(tx.status)} className="text-[10px]">
                          {txStatusLabel[tx.status] ?? tx.status}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
                {/* No note about the CHARGE here. A seller never sees that row -
                    it covers every seller's goods, so `visibleTxns` filters it
                    out - and a sentence explaining "the charge is what the buyer
                    paid after the coupon" pointed at something that is not on
                    the page. The same promise is made, in full, under the payout
                    breakdown below, where the seller's own figures are. */}
              </CardContent>
            </Card>
          )}

          {/* ── Your items ── */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{t("yourItems")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-0">
              {order.items.map((item, index) => {
                const variantMedia = item.variant?.media[0]?.media ?? null;
                const variantImageUrl =
                  variantMedia?.thumbUrl ?? variantMedia?.url ?? null;
                const productMedia = item.product.media[0] ?? null;
                const imageUrl =
                  variantImageUrl ??
                  productMedia?.thumbUrl ??
                  productMedia?.url ??
                  null;
                const variantLabel = getVariantLabel(item.variant, order.locale);
                const productTitle = getProductTitle(item.product, order.locale);

                return (
                  <div key={item.id}>
                    {index > 0 && <Separator className="my-3" />}
                    <div className="flex gap-4 items-center">
                      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded border bg-muted">
                        {imageUrl && (
                          <RetryImage src={imageUrl} alt={productTitle} fill sizes="56px" className="object-cover" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{productTitle}</p>
                        {variantLabel && (
                          <p className="text-xs text-muted-foreground">{variantLabel}</p>
                        )}
                        {item.variant?.sku && !variantLabel && (
                          <p className="text-xs text-muted-foreground">SKU: {item.variant.sku}</p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          {formatPrice(item.price, order.currency as Currency, locale)} × {item.quantity}
                        </p>
                      </div>
                      <p className="font-semibold text-sm shrink-0">
                        {formatPrice(item.price * item.quantity, order.currency as Currency, locale)}
                      </p>
                    </div>
                  </div>
                );
              })}

              <Separator className="my-4" />

              {/* ── Cash to collect (COD only) ──
                  The one number a courier acts on, and it is NOT the subtotal:
                  the buyer pays this part's goods less its share of the coupon,
                  plus its delivery (syncOrderFromParts builds the order total
                  from exactly that). Without this line the seller has to derive
                  it, and the obvious guess - goods plus delivery - overcharges
                  the buyer by the coupon. Broken out line by line so the figure
                  can be checked rather than trusted. */}
              {isCod && !isCancelled && (
                <div className="mb-4 rounded-lg border bg-muted/40 p-3 space-y-1.5 text-sm">
                  <div className="flex justify-between text-muted-foreground">
                    <span>{t("codGoods")}</span>
                    <span className="tabular-nums">
                      {formatPrice(part.itemsSubtotal, order.currency as Currency, locale)}
                    </span>
                  </div>
                  {part.discountShare > 0 && (
                    <div className="flex justify-between text-muted-foreground">
                      <span>{t("couponPlatformFunded", { code: order.couponCode ?? "" })}</span>
                      <span className="tabular-nums">
                        -{formatPrice(part.discountShare, order.currency as Currency, locale)}
                      </span>
                    </div>
                  )}
                  {part.shippingAmount > 0 && (
                    <div className="flex justify-between text-muted-foreground">
                      <span>{t("shippingCollected")}</span>
                      <span className="tabular-nums">
                        +{formatPrice(part.shippingAmount, order.currency as Currency, locale)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between font-semibold">
                    <span>{t("codToCollect")}</span>
                    <span className="tabular-nums">
                      {formatPrice(codCashToCollect, order.currency as Currency, locale)}
                    </span>
                  </div>
                  {/* The instruction is for a courier who has not gone yet. Once
                      the cash is in, the same figures stay as the record of what
                      was taken - telling them to collect it again would be
                      nonsense. */}
                  {part.discountShare > 0 && part.codSettledAt == null && (
                    <p className="pt-1 text-xs text-muted-foreground">{t("codToCollectNote")}</p>
                  )}
                </div>
              )}

              {/* Full payout breakdown: the seller is paid on the gross subtotal
                  minus the standard platform fee. Showing the fee explains why the
                  payout (also in the ledger) is less than the subtotal - it's the
                  commission, NOT the buyer's coupon. */}
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>{t("yourSubtotal")}</span>
                  <span className="tabular-nums">{formatPrice(order.orgSubtotal, order.currency as Currency, locale)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>{t("platformFee", { percent: PLATFORM_FEE_PERCENT })}</span>
                  <span className="tabular-nums">
                    -{formatPrice(platformFeeAmount(order.orgSubtotal), order.currency as Currency, locale)}
                  </span>
                </div>
                {orgShipping > 0 && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>{t("shippingCollected")}</span>
                    <span className="tabular-nums">
                      +{formatPrice(orgShipping, order.currency as Currency, locale)}
                    </span>
                  </div>
                )}
                {/* The coupon is deliberately NOT a line in this column. It
                    never touches the seller's earnings - on a card order the
                    platform transfers the full net, and on a COD one it gives
                    the same amount back by charging less commission - so as a
                    "+" row it was an addend that the bold total below did not
                    include, and the column stopped adding up: goods less
                    commission plus coupon came to more than the payout printed
                    under it. The amount is not lost; the note below the block
                    carries it, which is also where the promise is spelled out. */}
                <div className={`flex justify-between ${payoutReversed > 0 || codNetted > 0 || isCancelled ? "text-muted-foreground" : "font-semibold"}`}>
                  <span>{isCod ? t("codEarnings") : t("yourPayout")}</span>
                  <span className="tabular-nums">
                    {formatPrice(orgPayout, order.currency as Currency, locale)}
                  </span>
                </div>
                {/* COD closes with what this order put ON the running balance,
                    since no transfer will ever show it: the seller holds the
                    cash, so the commission is charged to that balance (or, when
                    the coupon outran it, credited to it).
                    
                    It says "charged"/"credited", not "you owe" / "we owe you".
                    The balance is a pool per currency across every order, and an
                    admin settles or pays out the pool, never a line of it - so
                    once that happens there is no way to say which order was
                    covered. This line stated a live obligation, and went on
                    stating it after the money had changed hands: a credit that
                    had just been paid out still read "the platform owes you". */}
                {/* What is left of it once goods came back - the debt shrinks as
                    the commission is credited, and saying otherwise would have
                    the seller chasing a figure the balance no longer holds. The
                    label follows the REMAINING sign: returns can carry it past
                    zero, from owing the platform to being owed by it. */}
                {isCod && !isCancelled && codOwedAfterRefunds !== 0 && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>
                      {codOwedAfterRefunds > 0 ? t("codOwedToPlatform") : t("codOwedToYou")}
                    </span>
                    <span className="tabular-nums">
                      {formatPrice(Math.abs(codOwedAfterRefunds), order.currency as Currency, locale)}
                    </span>
                  </div>
                )}
                {/* Some of this transfer was withheld to settle COD commission
                    this org owed from other orders (see releaseSellerPayout) -
                    without this line the ledger's PAYOUT amount below would
                    look unexplained lower than the math above it. Listed before
                    the clawback because that is the order the money moved in:
                    the netting happens at ship time, the refund later. */}
                {codNetted > 0 && (
                  <div className="flex justify-between text-destructive">
                    <span>{t("codBalanceNettedLabel")}</span>
                    <span className="tabular-nums">
                      -{formatPrice(codNetted, order.currency as Currency, locale)}
                    </span>
                  </div>
                )}
                {/* If items were refunded, show the payout clawback and the net
                    actually kept - matching the PAYOUT row in the ledger above. */}
                {/* A COD seller has no payout to reverse - they are holding the
                    cash, which is why the earnings line above says "what you
                    keep" rather than "your payout". These two lines were left
                    behind on the card wording and talked about a transfer that
                    never happens. */}
                {payoutReversedFromTransfer > 0 && (
                  <div className="flex justify-between text-destructive">
                    <span>{isCod ? t("codReversedLabel") : t("payoutReversed")}</span>
                    <span className="tabular-nums">
                      -{formatPrice(payoutReversedFromTransfer, order.currency as Currency, locale)}
                    </span>
                  </div>
                )}
                {(payoutReversedFromTransfer > 0 || codNetted > 0) && (
                  <div className="flex justify-between font-semibold">
                    <span>{isCod ? t("codAfterRefundsLabel") : t("payoutAfterRefunds")}</span>
                    <span className="tabular-nums">
                      {formatPrice(finalTransferred, order.currency as Currency, locale)}
                    </span>
                  </div>
                )}
                {/* Cancelled orders reach none of the rows above (no transfer,
                    so no netting and nothing to claw back) - the payout figure
                    would otherwise stand alone in bold as if it were coming. */}
                {isCancelled && (
                  <div className="flex justify-between font-semibold">
                    <span>{t("payoutAfterCancellation")}</span>
                    <span className="tabular-nums">
                      {formatPrice(0, order.currency as Currency, locale)}
                    </span>
                  </div>
                )}
              </div>
              {isCancelled && (
                <p className="mt-3 text-[11px] text-muted-foreground/80">
                  {t("cancelledNoPayoutNote")}
                </p>
              )}
              {/* Someone refunded the buyer straight from Stripe, and this
                  order is not written off yet - so nothing has come out of this
                  seller's money for it. Saying nothing would leave a REFUND row
                  in the ledger above with no explanation, and drawing a clawback
                  (which is what this page used to do) would claim money left
                  when none did. It says which, with the amount. */}
              {externalRefundPending > 0 && (
                <p className="mt-3 text-[11px] text-muted-foreground/80">
                  {t("externalRefundNotDeductedNote", {
                    amount: formatPrice(
                      externalRefundPending,
                      order.currency as Currency,
                      locale,
                    ),
                  })}
                </p>
              )}
              {/* ...and where the live figure actually lives, so nobody reads
                  the line above as a running total. */}
              {isCod && !isCancelled && codOwedAfterRefunds !== 0 && (
                <p className="mt-3 text-[11px] text-muted-foreground/80">
                  {t("codBalancePooledNote")}
                </p>
              )}
              {/* The commission line above moved because goods came back. Said
                  with its amount rather than left for the seller to work out
                  from the difference between two figures on two cards.
                  Which way it moved decides the sentence: a debt being paid
                  down is money coming back to the seller, while a credit the
                  platform owed them getting SMALLER is the opposite, and one
                  sentence covering both would be wrong in one of the two. A
                  20% coupon against a 10% commission puts every seller in the
                  second case, so it is not the rare branch.

                  It carries BOTH figures, the movement and what is left, rather
                  than pointing at "the amount above": a refund adds a clawback
                  line and a final-total line between this note and the
                  commission it is about, so the nearest figure above it is not
                  the one it means. */}
              {isCod && !isCancelled && codCommissionCredited !== 0 && (
                <p className="mt-3 text-[11px] text-muted-foreground/80">
                  {t(codCommissionCredited > 0 ? "codCommissionCreditedNote" : "codCreditReducedNote", {
                    amount: formatPrice(
                      Math.abs(codCommissionCredited),
                      order.currency as Currency,
                      locale,
                    ),
                    remaining: formatPrice(
                      Math.abs(codOwedAfterRefunds),
                      order.currency as Currency,
                      locale,
                    ),
                  })}
                </p>
              )}
              {codNetted > 0 && codDebtRestored === 0 && (
                <p className="mt-3 text-[11px] text-muted-foreground/80">
                  {t("codBalanceNettedNote")}
                </p>
              )}
              {/* The refund undid the debt relief the netting had given: that
                  slice is owed again. Said here rather than as another column,
                  which would net to zero and read as if nothing happened. */}
              {codDebtRestored > 0 && (
                <p className="mt-3 text-[11px] text-muted-foreground/80">
                  {t("codDebtRestoredNote", {
                    amount: formatPrice(codDebtRestored, order.currency as Currency, locale),
                  })}
                </p>
              )}
              {/* Buyer used a platform-funded coupon: the seller is still paid on
                  the full gross subtotal above, so make clear the coupon never
                  touches this breakdown. */}
              {order.discountAmount > 0 && !isCancelled && (
                <p className="mt-3 text-[11px] text-muted-foreground/80">
                  {t("couponSellerNote", {
                    code: order.couponCode ?? "",
                    percent: PLATFORM_FEE_PERCENT,
                    amount: formatPrice(part.discountShare, order.currency as Currency, locale),
                  })}
                </p>
              )}
            </CardContent>
          </Card>

          {/* ── Buyer & shipping ── */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                {t("buyerAndShipping")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              {/* Buyer info */}
              <div className="space-y-1">
                {order.user.name && (
                  <p className="font-medium">{order.user.name}</p>
                )}
                <a
                  href={`mailto:${order.user.email}`}
                  className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Mail className="h-3.5 w-3.5" />
                  {order.user.email}
                </a>
              </div>

              {/* Shipping address */}
              {order.shippingLine1 ? (
                <div className="space-y-0.5 text-muted-foreground">
                  <p className="text-xs font-semibold uppercase tracking-wide text-foreground">
                    {t("deliveryAddress")}
                  </p>
                  {order.shippingName && (
                    <p className="text-foreground font-medium">{order.shippingName}</p>
                  )}
                  <p>{order.shippingLine1}</p>
                  {order.shippingLine2 && <p>{order.shippingLine2}</p>}
                  <p>
                    {[order.shippingCity, order.shippingState, order.shippingPostalCode]
                      .filter(Boolean)
                      .join(", ")}
                  </p>
                  {order.shippingCountry && <p>{order.shippingCountry}</p>}
                </div>
              ) : (
                <p className="text-muted-foreground text-xs">{t("noShippingAddress")}</p>
              )}
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  );
}