import { getGlobalTag, getIdTag } from "@/lib/dataCache";
import { revalidateTag } from "next/cache";

function scope(orgId: string) {
  return `products-${orgId}`;
}

export function getProductGlobalTag(orgId: string) {
  return getGlobalTag(scope(orgId));
}

export function getProductIdTag(orgId: string, id: string) {
  return getIdTag(scope(orgId), id);
}

export function revalidateProductCache(orgId: string, id: string) {
  revalidateTag(getProductGlobalTag(orgId), "default");
  revalidateTag(getProductIdTag(orgId, id), "default");
}
