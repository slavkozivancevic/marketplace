"use client";

import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { dateLocale } from "@/lib/i18n/dateLocale";
import { Truck, CreditCard, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { UserOrderListItem } from "../db/orders";
import type { Currency } from "@/lib/currency-config";
import { formatPrice } from "@/lib/currency";

function getStatusVariant(status: string) {
  switch (status) {
    case "COMPLETED":
      return "default" as const;
    case "CANCELLED":
    case "REFUNDED":
      return "destructive" as const;
    default:
      return "secondary" as const;
  }
}

function PaymentMethodIcon({ method }: { method: string }) {
  if (method === "COD") return <Truck className="h-3.5 w-3.5 text-muted-foreground shrink-0" />;
  return <CreditCard className="h-3.5 w-3.5 text-muted-foreground shrink-0" />;
}

export function OrderTableRow({ order }: { order: UserOrderListItem }) {
  const router = useRouter();
  const t = useTranslations("orders");
  const locale = useLocale();
  const dl = dateLocale(locale);

  return (
    <div
      role="row"
      className="grid grid-cols-[100px_100px_80px_minmax(200px,2fr)_120px_170px] items-center gap-4 border-b p-3 cursor-pointer hover:bg-muted/50 transition-colors min-w-fit"
      onClick={() => router.push(`/${locale}/dashboard/orders/${order.id}`)}
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
      <div role="cell" className="text-sm truncate">
        {order.items.map((item, i) => {
          // Order row label uses the title in the order's captured locale so
          // the buyer sees their own language even when navigating later.
          const title =
            item.product.translations.find((tr) => tr.locale === order.locale)?.title ??
            item.product.translations.find((tr) => tr.locale === "en")?.title ??
            "";
          const label = item.variant?.sku ? `${title} (${item.variant.sku})` : title;
          const qty = item.quantity > 1 ? ` ×${item.quantity}` : "";
          return (i > 0 ? ", " : "") + label + qty;
        }).join("")}
      </div>

      {/* Total */}
      <div role="cell" className="font-semibold text-sm text-right tabular-nums">
        {formatPrice(order.total, order.currency as Currency)}
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
        <PaymentMethodIcon method={order.paymentMethod} />
        <Badge variant={getStatusVariant(order.status)}>
          {t(order.status.toLowerCase() as "pending" | "pending_cod" | "completed" | "cancelled" | "refunded" | "awaiting_payment")}
        </Badge>
      </div>
    </div>
  );
}