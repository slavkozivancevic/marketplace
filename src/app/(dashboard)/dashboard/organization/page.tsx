import { cacheTag } from "next/cache";
import { notFound } from "next/navigation";

import { resolveRequestContext } from "@/lib/auth/resolveRequestContext";
import { getOrganizationById } from "@/features/organizations/db/organizations";
import { getPendingInvitesByOrg } from "@/features/organizations/db/invites";
import { CacheTags } from "@/lib/cache/tags";
import { OrganizationSettingsForm } from "@/features/organizations/components/OrganizationSettingsForm";
import { InviteForm } from "@/features/organizations/components/InviteForm";
import { InviteList } from "@/features/organizations/components/InviteList";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { MembershipRole } from "@/generated/prisma/client";

export default async function OrganizationPage() {
  const ctx = await resolveRequestContext();

  const [organization, invites] = await Promise.all([
    fetchOrganization(ctx.organizationId),
    fetchInvites(ctx.organizationId),
  ]);

  if (!organization) notFound();

  const canEdit =
    ctx.membershipRole === MembershipRole.OWNER ||
    ctx.membershipRole === MembershipRole.ADMIN;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="shrink-0 px-6">
        <PageHeader
          title="Organization Settings"
          description="Manage your organization details and members."
        />
      </div>
      <div className="flex-1 overflow-y-auto min-h-0 px-6 pb-6">
        <div className="space-y-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>General</CardTitle>
            <Badge variant={organization.verified ? "default" : "secondary"}>
              {organization.verified ? "Verified" : "Unverified"}
            </Badge>
          </CardHeader>
          <CardContent>
            {!organization.verified && (
              <p className="text-sm text-muted-foreground mb-4">
                Your organization is pending verification. Some features may be
                restricted until an admin verifies your organization.
              </p>
            )}
            <OrganizationSettingsForm
              currentName={organization.name}
              canEdit={canEdit}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Members ({organization.members.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {organization.members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between py-2"
                >
                  <div>
                    <p className="text-sm font-medium">
                      {member.user.name || member.user.email}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {member.user.email}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{member.user.role}</Badge>
                    <Badge variant="secondary">{member.role}</Badge>
                  </div>
                </div>
              ))}
            </div>
            {organization.members.length > 1 && <Separator className="mt-4" />}
          </CardContent>
        </Card>

        {canEdit && (
          <Card>
            <CardHeader>
              <CardTitle>Invite Member</CardTitle>
            </CardHeader>
            <CardContent>
              <InviteForm />
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Pending Invites</CardTitle>
          </CardHeader>
          <CardContent>
            <InviteList invites={invites} canManage={canEdit} />
          </CardContent>
        </Card>
        </div>
      </div>
    </div>
  );
}

async function fetchOrganization(organizationId: string) {
  "use cache";
  cacheTag(CacheTags.organizations.byId(organizationId));
  cacheTag(CacheTags.organizations.members(organizationId));
  return getOrganizationById(organizationId);
}

async function fetchInvites(organizationId: string) {
  "use cache";
  cacheTag(CacheTags.organizations.byId(organizationId));
  cacheTag(CacheTags.organizations.invites(organizationId));
  return getPendingInvitesByOrg(organizationId);
}
