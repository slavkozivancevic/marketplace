"use client";

import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { TableCell, TableRow } from "@/components/ui/table";
import { getUserOrders } from "../db/orders";

type Order = Awaited<ReturnType<typeof getUserOrders>>[number];

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

export function OrderTableRow({ order }: { order: Order }) {
  const router = useRouter();

  return (
    <TableRow
      className="cursor-pointer"
      onClick={() => router.push(`/dashboard/orders/${order.id}`)}
    >
      <TableCell className="font-mono text-xs text-muted-foreground">
        {order.id.slice(0, 8)}...
      </TableCell>
      <TableCell>
        {new Date(order.createdAt).toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
        })}
      </TableCell>
      <TableCell className="text-muted-foreground">
        {new Date(order.createdAt).toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
        })}
      </TableCell>
      <TableCell>
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
      </TableCell>
      <TableCell className="font-semibold">
        ${order.total.toFixed(2)}
      </TableCell>
      <TableCell>
        <Badge variant={getStatusVariant(order.status)}>
          {order.status}
        </Badge>
      </TableCell>
    </TableRow>
  );
}
