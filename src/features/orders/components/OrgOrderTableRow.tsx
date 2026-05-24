"use client";

import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { dateLocale } from "@/lib/i18n/dateLocale";
import { Truck, CreditCard } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { OrgOrderListItem } from "../db/orgOrders";
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

export function OrgOrderTableRow({ order }: { order: OrgOrderListItem }) {
  const router = useRouter();
  const t = useTranslations("orgOrders");
  const dl = dateLocale(useLocale());

  const itemSummary = order.items
    .map((i) => {
      const label = i.variant?.sku ? `${i.product.title} (${i.variant.sku})` : i.product.title;
      return i.quantity > 1 ? `${label} ×${i.quantity}` : label;
    })
    .join(", ");

  return (
    <div
      role="row"
      className="grid grid-cols-[100px_100px_80px_minmax(180px,2fr)_140px_120px_130px] items-center gap-4 border-b p-3 cursor-pointer hover:bg-muted/50 transition-colors min-w-fit"
      onClick={() => router.push(`/dashboard/organization/orders/${order.id}`)}
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
      <div role="cell" className="font-semibold text-sm">
        {formatPrice(order.orgSubtotal, order.currency as Currency)}
      </div>

      {/* Status */}
      <div role="cell" className="flex items-center gap-1.5">
        <PaymentMethodIcon method={order.paymentMethod} />
        <Badge variant={getStatusVariant(order.status)}>
          {t(order.status.toLowerCase() as "pending" | "pending_cod" | "completed" | "cancelled" | "refunded")}
        </Badge>
      </div>
    </div>
  );
}