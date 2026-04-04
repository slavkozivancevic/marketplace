import { revalidateTag } from "next/cache";
import { CacheTags } from "@/lib/cache/tags";

export function revalidateOrganizationCache(orgId: string) {
  revalidateTag(CacheTags.organizations.all(), "max");
  revalidateTag(CacheTags.organizations.byId(orgId), "max");
}

export function revalidateOrganizationMembers(orgId: string) {
  revalidateTag(CacheTags.organizations.all(), "max");
  revalidateTag(CacheTags.organizations.byId(orgId), "max");
  revalidateTag(CacheTags.organizations.members(orgId), "max");
}

export function revalidateOrganizationInvites(orgId: string) {
  revalidateTag(CacheTags.organizations.byId(orgId), "max");
  revalidateTag(CacheTags.organizations.invites(orgId), "max");
}
