import { safeAuth } from "@/lib/auth/safeAuth";
import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { cacheTag } from "next/cache";

import { Header } from "@/components/layout/header";
import { DashboardSidebar } from "@/components/layout/dashboard-sidebar";
import { UnsavedChangesGuard } from "@/components/forms/UnsavedChangesGuard";
import { ActiveOrgProvider } from "@/features/organizations/components/ActiveOrgContext";
import { canManageOrgPayouts } from "@/lib/auth/permissions";
import { CacheTags } from "@/lib/cache/tags";
import { prisma } from "@/core/db/prisma";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await safeAuth();

  if (!userId) {
    const locale = await getLocale();
    redirect(`/${locale}/sign-in`);
  }

  const user = await fetchLayoutUser(userId);

  const userRole = user?.role ?? "USER";
  const organizations = user?.memberships.map((m) => m.organization) ?? [];
  const currentOrgId = user?.activeOrgId ?? organizations[0]?.id ?? "";

  // Gate the payouts nav entry on the active-org membership role, matching the
  // payouts page guard - so we never show a link that would just bounce.
  const activeMembership = user?.memberships.find((m) => m.orgId === currentOrgId);
  const canManagePayouts = activeMembership
    ? canManageOrgPayouts(activeMembership.role)
    : false;

  return (
    <ActiveOrgProvider orgId={currentOrgId}>
      {/* `overflow-clip`, not `overflow-hidden` - see admin/layout.tsx: the
          shell must never be a scroll container, or a sideways overflow can
          park the whole page in a blank void beside the content. */}
      <div className="flex h-dvh flex-col overflow-clip">
        <Header />
        <div className="flex flex-1 min-h-0">
          <DashboardSidebar
            userRole={userRole}
            organizations={organizations}
            currentOrgId={currentOrgId}
            canManagePayouts={canManagePayouts}
          />
          {/* `min-w-0` is required next to `overflow-clip` - see
              admin/layout.tsx: clip is not a scroll container, so without it
              main takes the min-content width of the widest table inside and
              pushes the whole row past the viewport. */}
          <main className="flex-1 min-w-0 flex flex-col min-h-0 overflow-clip">
            {children}
          </main>
        </div>
        <UnsavedChangesGuard />
      </div>
    </ActiveOrgProvider>
  );
}

async function fetchLayoutUser(clerkUserId: string) {
  "use cache";
  cacheTag(CacheTags.users.all());
  cacheTag(CacheTags.users.byClerkId(clerkUserId));
  // We join each membership's organization name below, so this cache must also
  // react to org mutations (e.g. a rename). Without the org tag the sidebar
  // switcher keeps showing the stale name until the user cache happens to bust.
  cacheTag(CacheTags.organizations.all());
  return prisma.user.findUnique({
    where: { clerkUserId },
    select: {
      role: true,
      activeOrgId: true,
      memberships: {
        select: {
          orgId: true,
          role: true,
          organization: { select: { id: true, name: true } },
        },
      },
    },
  });
}
