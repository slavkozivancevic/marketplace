"use client";

import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { dateLocale } from "@/lib/i18n/dateLocale";
import { Truck, CreditCard, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { OrgOrderListItem } from "../db/orgOrders";
import type { Currency } from "@/lib/currency-config";
import { formatPrice } from "@/lib/currency";
import { deriveOrderStatus } from "../status";
import { orderStatusKey, orderStatusVariant } from "../statusBadge";

function PaymentMethodIcon({ method }: { method: string }) {
  if (method === "COD") return <Truck className="h-3.5 w-3.5 text-muted-foreground shrink-0" />;
  return <CreditCard className="h-3.5 w-3.5 text-muted-foreground shrink-0" />;
}

export function OrgOrderTableRow({ order }: { order: OrgOrderListItem }) {
  const router = useRouter();
  const t = useTranslations("orgOrders");
  const locale = useLocale();
  const dl = dateLocale(locale);

  const itemSummary = order.items
    .map((i) => {
      // Org order rows display titles in the buyer's order-time locale so
      // sellers see the same string the buyer saw when ordering.
      const title =
        i.product.translations.find((tr) => tr.locale === order.locale)?.title ??
        i.product.translations.find((tr) => tr.locale === "en")?.title ??
        "";
      const label = i.variant?.sku ? `${title} (${i.variant.sku})` : title;
      return i.quantity > 1 ? `${label} ×${i.quantity}` : label;
    })
    .join(", ");

  return (
    <div
      role="row"
      className="grid grid-cols-[100px_100px_80px_minmax(180px,2fr)_140px_120px_230px] items-center gap-4 border-b p-3 cursor-pointer hover:bg-muted/50 transition-colors min-w-fit"
      onClick={() => router.push(`/${locale}/dashboard/organization/orders/${order.id}`)}
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
            Amber text pill - consistent with the order detail + payouts pages. */}
        {order.paymentStatus === "PARTIALLY_REFUNDED" && (
          <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300">
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
  );
}