import { revalidatePath, revalidateTag } from "next/cache";
import { CacheTags } from "@/lib/cache/tags";

export function revalidateOrderCache(userId: string, orderId: string) {
  revalidateTag(CacheTags.orders.byUser(userId), "max");
  revalidateTag(CacheTags.orders.byId(orderId), "max");

  revalidatePath("/dashboard/orders");
  revalidatePath(`/dashboard/orders/${orderId}`);
}
