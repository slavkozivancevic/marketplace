import { cacheTag } from "next/cache";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

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
  const t = await getTranslations();
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
          title={t("organization.title")}
          description={t("organization.manage")}
        />
      </div>
      <div className="flex-1 overflow-y-auto min-h-0 px-6 pb-6">
        <div className="space-y-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{t("organization.general")}</CardTitle>
            <Badge variant={organization.verified ? "default" : "secondary"}>
              {organization.verified ? t("organization.verified") : t("organization.unverified")}
            </Badge>
          </CardHeader>
          <CardContent>
            {!organization.verified && (
              <p className="text-sm text-muted-foreground mb-4">
                {t("organization.pendingVerification")}
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
            <CardTitle>{t("organization.members", { count: organization.members.length })}</CardTitle>
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
                    <Badge variant="outline">
                      {member.user.role === "USER" ? t("users.user") : member.user.role === "SELLER" ? t("users.seller") : t("users.admin")}
                    </Badge>
                    <Badge variant="secondary">
                      {member.role === "OWNER" ? t("organization.roleOwner") : member.role === "ADMIN" ? t("organization.roleAdmin") : t("organization.roleMember")}
                    </Badge>
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
              <CardTitle>{t("organization.inviteMember")}</CardTitle>
            </CardHeader>
            <CardContent>
              <InviteForm />
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>{t("organization.pendingInvites")}</CardTitle>
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
