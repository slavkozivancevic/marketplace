"use client";

import { Link } from "@/i18n/navigation";
import { useTranslations, useLocale } from "next-intl";
import { dateLocale } from "@/lib/i18n/dateLocale";
import { Truck, CreditCard, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { OrgOrderListItem } from "../db/orgOrders";
import type { Currency } from "@/lib/currency-config";
import { formatPrice } from "@/lib/currency";
import { getVariantLabel } from "@/features/attributes/utils/translations";
import { getProductTitle } from "@/features/products/utils/translations";
import {
  deriveOrderStatus,
  deriveSellerPartStage,
  sellerPartRefundState,
} from "../status";
import { orderStatusKey, orderStatusVariant } from "../statusBadge";
import { cn } from "@/lib/utils";
// Grid template is owned by the skeleton module so the two can never drift.
import { ORG_ORDER_COLS } from "./OrderTableSkeleton";

function PaymentMethodIcon({ method }: { method: string }) {
  if (method === "COD") return <Truck className="h-3.5 w-3.5 text-muted-foreground shrink-0" />;
  return <CreditCard className="h-3.5 w-3.5 text-muted-foreground shrink-0" />;
}

export function OrgOrderTableRow({ order }: { order: OrgOrderListItem }) {
  const t = useTranslations("orgOrders");
  const locale = useLocale();
  const dl = dateLocale(locale);

  // Everything this row says about refunds is about THIS seller's goods: what
  // the org had refunded on the order, against what its own part was worth.
  const orgRefund = {
    refundedGross: order.orgRefundedGross,
    itemsSubtotal: order.sellerPart?.itemsSubtotal ?? 0,
  };
  const refundState = sellerPartRefundState(orgRefund, order.paymentStatus);

  const itemSummary = order.items
    .map((i) => {
      // Org order rows display titles in the buyer's order-time locale so
      // sellers see the same string the buyer saw when ordering.
      // `getProductTitle` (not a raw `find(locale)?.title ?? ...`) - a locale
      // can HAVE a translation row whose title was left blank, and `??` would
      // then hand back that empty string instead of falling back to English.
      const title = getProductTitle(i.product, order.locale);
      const variantLabel = getVariantLabel(i.variant, order.locale) ?? i.variant?.sku ?? null;
      const label = variantLabel ? `${title} (${variantLabel})` : title;
      return i.quantity > 1 ? `${label} ×${i.quantity}` : label;
    })
    .join(", ");

  return (
    // display:contents keeps this Link out of the CSS grid layout below -
    // the grid columns are on the row div, not this wrapper - while giving
    // the row a real <a> for NavigationProgress's click detection to see.
    <Link
      href={{ pathname: "/dashboard/organization/orders/[id]", params: { id: order.id } }}
      className="contents"
    >
      <div
        role="row"
        className={cn(
          "grid items-center gap-4 border-b p-3 cursor-pointer hover:bg-muted/50 transition-colors min-w-fit",
          ORG_ORDER_COLS,
        )}
      >
        {/* Order ID */}
        <div role="cell" className="font-mono text-xs text-muted-foreground">
          #{order.id.slice(-8).toUpperCase()}
        </div>

        {/* Date */}
        <div role="cell" className="text-sm">
          {new Date(order.createdAt).toLocaleDateString(dl, {
            year: "numeric",
            month: "short",
            day: "numeric",
          })}
        </div>

        {/* Time */}
        <div role="cell" className="text-sm text-muted-foreground">
          {new Date(order.createdAt).toLocaleTimeString(dl, {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </div>

        {/* Items */}
        <div role="cell" className="text-sm truncate" title={itemSummary}>
          {itemSummary}
        </div>

        {/* Buyer */}
        <div role="cell" className="text-sm text-muted-foreground truncate">
          {order.user.name ?? "-"}
        </div>

        {/* Org subtotal */}
        <div role="cell" className="font-semibold text-sm text-right tabular-nums">
          {formatPrice(order.orgSubtotal, order.currency as Currency, locale)}
        </div>

        {/* Status */}
        <div role="cell" className="flex items-center justify-center gap-1.5">
          {order.hasActiveReturn && (
            <Badge
              variant="outline"
              className="gap-1 px-1.5 text-[10px]"
              title={t("returnInProgress")}
            >
              <RotateCcw className="h-3 w-3" />
              <span className="sr-only">{t("returnInProgress")}</span>
            </Badge>
          )}
          {/* Partial refund: the derived status still reads e.g. "Completed", so
              flag it here (full refunds already show as the main "Refunded").
              Steel text pill - consistent with the order detail + payouts pages.
              THIS seller's own goods, not the order's payment axis: that axis
              carries every seller's refunds, so it put this pill on the row of a
              seller who had never had a single unit come back. */}
          {refundState === "partial" && (
            <Badge variant="outline" className="text-[10px] text-steel border-steel/40">
              {t("partiallyRefunded")}
            </Badge>
          )}
          <PaymentMethodIcon method={order.paymentMethod} />
          {(() => {
            // This seller's own stage, not the order's: in a multi-seller order
            // the two genuinely differ, and the seller is owed its own.
            const ds = order.sellerPart
              ? deriveSellerPartStage({
                  part: order.sellerPart,
                  paymentMethod: order.paymentMethod,
                  orderPaymentStatus: order.paymentStatus,
                  orgRefund,
                })
              : deriveOrderStatus(order);
            return (
              <Badge variant={orderStatusVariant(ds)}>{t(orderStatusKey(ds))}</Badge>
            );
          })()}
        </div>
      </div>
    </Link>
  );
}