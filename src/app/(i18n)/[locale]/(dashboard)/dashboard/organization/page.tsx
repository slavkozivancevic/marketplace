import { cacheTag } from "next/cache";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import { resolveRequestContext } from "@/lib/auth/resolveRequestContext";
import { getOrganizationById } from "@/features/organizations/db/organizations";
import { getPendingInvitesByOrg } from "@/features/organizations/db/invites";
import { CacheTags } from "@/lib/cache/tags";
import { OrganizationSettingsForm } from "@/features/organizations/components/OrganizationSettingsForm";
import { OrgShippingForm } from "@/features/organizations/components/OrgShippingForm";
import { InviteForm } from "@/features/organizations/components/InviteForm";
import { InviteList } from "@/features/organizations/components/InviteList";
import { MemberList } from "@/features/organizations/components/MemberList";
import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { getPathname } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MembershipRole } from "@/generated/prisma/client";

export default async function OrganizationPage() {
  const t = await getTranslations();
  const tCrumbs = await getTranslations("breadcrumbs");
  const locale = await getLocale();
  const breadcrumbItems = [
    { name: tCrumbs("dashboard"), href: getPathname({ href: "/dashboard", locale }) },
    { name: tCrumbs("organization"), href: getPathname({ href: "/dashboard/organization", locale }) },
  ];
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
      <div className="shrink-0 px-6 pt-2">
        <Breadcrumbs items={breadcrumbItems} seo={false} />
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
            {/* No remount key: the form re-syncs to the server name via its
                memoized `values` prop. A fresh `crypto.randomUUID()` key here
                remounted the form on every (PPR/dynamic) server render, which
                wiped RHF's dirty state and re-baselined the input, so edits
                never registered as unsaved. */}
            <OrganizationSettingsForm
              currentName={organization.name}
              canEdit={canEdit}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("organization.shippingTitle")}</CardTitle>
            <p className="text-sm text-muted-foreground">{t("organization.shippingDesc")}</p>
          </CardHeader>
          <CardContent>
            <OrgShippingForm
              key={crypto.randomUUID()}
              flatRate={organization.shippingFlatRate}
              freeThreshold={organization.shippingFreeThreshold}
              canEdit={canEdit}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("organization.members", { count: organization.members.length })}</CardTitle>
          </CardHeader>
          <CardContent>
            <MemberList
              members={organization.members}
              currentUserId={ctx.userId}
              canManage={canEdit}
              currentUserRole={ctx.membershipRole}
            />
          </CardContent>
        </Card>

        {canEdit && (
          <>
            <Card>
              <CardHeader>
                <CardTitle>{t("organization.inviteMember")}</CardTitle>
              </CardHeader>
              <CardContent>
                <InviteForm key={crypto.randomUUID()} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t("organization.pendingInvites")}</CardTitle>
              </CardHeader>
              <CardContent>
                <InviteList invites={invites} canManage={canEdit} />
              </CardContent>
            </Card>
          </>
        )}
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