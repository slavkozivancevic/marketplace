import { revalidatePath, revalidateTag } from "next/cache";
import { CacheTags } from "@/lib/cache/tags";

export function revalidateOrderCache(userId: string, orderId: string) {
  revalidateTag(CacheTags.orders.byUser(userId), "max");
  revalidateTag(CacheTags.orders.byId(orderId), "max");

  // Dynamic routes must be revalidated by their route pattern (bracketed
  // params), not a concrete value - passing a literal id matches nothing,
  // so the page and its client Router Cache entry never get busted.
  revalidatePath("/[locale]/dashboard/orders", "page");
  revalidatePath("/[locale]/dashboard/orders/[id]", "page");
}