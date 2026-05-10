"use client";

import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { dateLocale } from "@/lib/i18n/dateLocale";
import { Truck } from "lucide-react";
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

export function OrderTableRow({ order }: { order: UserOrderListItem }) {
  const router = useRouter();
  const t = useTranslations("orders");
  const dl = dateLocale(useLocale());

  return (
    <div
      role="row"
      className="grid grid-cols-[100px_100px_80px_minmax(200px,2fr)_120px_120px] items-center gap-4 border-b p-3 cursor-pointer hover:bg-muted/50 transition-colors min-w-fit"
      onClick={() => router.push(`/dashboard/orders/${order.id}`)}
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
          const label = item.variant?.sku
            ? `${item.product.title} (${item.variant.sku})`
            : item.product.title;
          const qty = item.quantity > 1 ? ` ×${item.quantity}` : "";
          return (i > 0 ? ", " : "") + label + qty;
        }).join("")}
      </div>

      {/* Total */}
      <div role="cell" className="font-semibold text-sm">
        {formatPrice(order.total, order.currency as Currency)}
      </div>

      {/* Status */}
      <div role="cell" className="flex items-center gap-1.5">
        {order.paymentMethod === "COD" && (
          <Truck className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        )}
        <Badge variant={getStatusVariant(order.status)}>
          {t(order.status.toLowerCase() as "pending" | "pending_cod" | "completed" | "cancelled" | "refunded")}
        </Badge>
      </div>
    </div>
  );
}