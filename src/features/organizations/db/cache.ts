import { revalidatePath, revalidateTag } from "next/cache";
import { CacheTags } from "@/lib/cache/tags";

export function revalidateOrganizationCache(orgId: string) {
  revalidateTag(CacheTags.organizations.all(), "max");
  revalidateTag(CacheTags.organizations.byId(orgId), "max");

  revalidatePath("/[locale]/dashboard/organization", "page");
  revalidatePath("/[locale]/admin/organizations", "page");
  revalidatePath("/[locale]/dashboard/my-products", "page");
  revalidatePath("/[locale]/dashboard", "page");
}

export function revalidateOrganizationMembers(orgId: string) {
  revalidateTag(CacheTags.organizations.all(), "max");
  revalidateTag(CacheTags.organizations.byId(orgId), "max");
  revalidateTag(CacheTags.organizations.members(orgId), "max");

  revalidatePath("/[locale]/dashboard/organization", "page");
}

export function revalidateOrganizationInvites(orgId: string) {
  revalidateTag(CacheTags.organizations.byId(orgId), "max");
  revalidateTag(CacheTags.organizations.invites(orgId), "max");

  revalidatePath("/[locale]/dashboard/organization", "page");
}
