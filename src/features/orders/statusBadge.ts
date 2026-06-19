import { deriveOrderStatus, type OrderStatusValue, type OrderAxes } from "./status";

export { deriveOrderStatus as orderDisplayStatus };
export type { OrderAxes };

export type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

/** All lowercase status keys the UI may render (matches the i18n keys). */
export type OrderStatusKey =
  | "pending"
  | "processing"
  | "shipped"
  | "delivered"
  | "completed"
  | "cancelled"
  | "refunded";

export function orderStatusKey(status: OrderStatusValue): OrderStatusKey {
  return status.toLowerCase() as OrderStatusKey;
}

/** Badge color for a derived display status. */
export function orderStatusVariant(status: OrderStatusValue): BadgeVariant {
  switch (status) {
    case "COMPLETED":
      return "default";
    case "CANCELLED":
    case "REFUNDED":
      return "destructive";
    case "SHIPPED":
    case "DELIVERED":
      return "outline";
    default:
      return "secondary";
  }
}
