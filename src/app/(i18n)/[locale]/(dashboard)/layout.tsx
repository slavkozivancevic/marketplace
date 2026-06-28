import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { cacheTag } from "next/cache";

import { Header } from "@/components/layout/header";
import { DashboardSidebar } from "@/components/layout/dashboard-sidebar";
import { UnsavedChangesGuard } from "@/components/forms/UnsavedChangesGuard";
import { CacheTags } from "@/lib/cache/tags";
import { prisma } from "@/core/db/prisma";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();

  if (!userId) {
    const locale = await getLocale();
    redirect(`/${locale}/sign-in`);
  }

  const user = await fetchLayoutUser(userId);

  const userRole = user?.role ?? "USER";
  const organizations = user?.memberships.map((m) => m.organization) ?? [];
  const currentOrgId = user?.activeOrgId ?? organizations[0]?.id ?? "";

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <Header />
      <div className="flex flex-1 min-h-0">
        <DashboardSidebar
          userRole={userRole}
          organizations={organizations}
          currentOrgId={currentOrgId}
        />
        <main className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {children}
        </main>
      </div>
      <UnsavedChangesGuard />
    </div>
  );
}

async function fetchLayoutUser(clerkUserId: string) {
  "use cache";
  cacheTag(CacheTags.users.all());
  cacheTag(CacheTags.users.byClerkId(clerkUserId));
  return prisma.user.findUnique({
    where: { clerkUserId },
    select: {
      role: true,
      activeOrgId: true,
      memberships: {
        select: {
          orgId: true,
          organization: { select: { id: true, name: true } },
        },
      },
    },
  });
}
