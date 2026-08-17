"use client";

import { Link } from "@/i18n/navigation";
import { useTranslations, useLocale } from "next-intl";
import { dateLocale } from "@/lib/i18n/dateLocale";
import { Truck, CreditCard, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { OrgOrderListItem } from "../db/orgOrders";
import type { Currency } from "@/lib/currency-config";
import { formatPrice } from "@/lib/currency";
import { getProductTitle } from "@/features/products/utils/translations";
import { deriveOrderStatus } from "../status";
import { orderStatusKey, orderStatusVariant } from "../statusBadge";

function PaymentMethodIcon({ method }: { method: string }) {
  if (method === "COD") return <Truck className="h-3.5 w-3.5 text-muted-foreground shrink-0" />;
  return <CreditCard className="h-3.5 w-3.5 text-muted-foreground shrink-0" />;
}

export function OrgOrderTableRow({ order }: { order: OrgOrderListItem }) {
  const t = useTranslations("orgOrders");
  const locale = useLocale();
  const dl = dateLocale(locale);

  const itemSummary = order.items
    .map((i) => {
      // Org order rows display titles in the buyer's order-time locale so
      // sellers see the same string the buyer saw when ordering.
      // `getProductTitle` (not a raw `find(locale)?.title ?? ...`) - a locale
      // can HAVE a translation row whose title was left blank, and `??` would
      // then hand back that empty string instead of falling back to English.
      const title = getProductTitle(i.product, order.locale);
      const label = i.variant?.sku ? `${title} (${i.variant.sku})` : title;
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
        className="grid grid-cols-[100px_100px_80px_minmax(180px,2fr)_140px_120px_230px] items-center gap-4 border-b p-3 cursor-pointer hover:bg-muted/50 transition-colors min-w-fit"
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
          {formatPrice(order.orgSubtotal, order.currency as Currency)}
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
              Steel text pill - consistent with the order detail + payouts pages. */}
          {order.paymentStatus === "PARTIALLY_REFUNDED" && (
            <Badge variant="outline" className="text-[10px] text-steel border-steel/40">
              {t("partiallyRefunded")}
            </Badge>
          )}
          <PaymentMethodIcon method={order.paymentMethod} />
          {(() => {
            const ds = deriveOrderStatus(order);
            return (
              <Badge variant={orderStatusVariant(ds)}>{t(orderStatusKey(ds))}</Badge>
            );
          })()}
        </div>
      </div>
    </Link>
  );
}