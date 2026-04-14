"use client";

import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import type { UserOrderListItem } from "../db/orders";

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

  return (
    <div
      role="row"
      className="grid grid-cols-[100px_100px_80px_minmax(200px,2fr)_80px_100px] items-center gap-4 border-b p-3 cursor-pointer hover:bg-muted/50 transition-colors min-w-fit"
      onClick={() => router.push(`/dashboard/orders/${order.id}`)}
    >
      <div role="cell" className="font-mono text-xs text-muted-foreground">
        {order.id.slice(0, 8)}...
      </div>
      <div role="cell">
        {new Date(order.createdAt).toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
        })}
      </div>
      <div role="cell" className="text-muted-foreground">
        {new Date(order.createdAt).toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
        })}
      </div>
      <div role="cell">
        {order.items.map((item) => (
          <div key={item.id} className="text-sm">
            {item.product.title}
            {item.variant && (
              <span className="text-muted-foreground">
                {" "}· {item.variant.sku}
              </span>
            )}
            {item.quantity > 1 && (
              <span className="text-muted-foreground">
                {" "}× {item.quantity}
              </span>
            )}
          </div>
        ))}
      </div>
      <div role="cell" className="font-semibold">
        ${order.total.toFixed(2)}
      </div>
      <div role="cell">
        <Badge variant={getStatusVariant(order.status)}>
          {order.status}
        </Badge>
      </div>
    </div>
  );
}
