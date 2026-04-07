import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { cacheTag } from "next/cache";

import { Header } from "@/components/layout/header";
import { OrganizationSwitcher } from "@/features/organizations/components/OrganizationSwitcher";
import { CacheTags } from "@/lib/cache/tags";
import { prisma } from "@/core/db/prisma";
import Link from "next/link";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  const user = await fetchLayoutUser(userId);

  const userRole = user?.role ?? "USER";
  const organizations = user?.memberships.map((m) => m.organization) ?? [];
  const currentOrgId = user?.activeOrgId ?? organizations[0]?.id ?? "";

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <div className="flex flex-1">
        <aside className="w-64 border-r p-6">
          <nav className="space-y-2">
            <h2 className="font-semibold mb-4">Dashboard</h2>

            {organizations.length > 1 && (
              <div className="mb-4">
                <p className="text-xs text-muted-foreground mb-1">
                  Organization
                </p>
                <OrganizationSwitcher
                  organizations={organizations}
                  currentOrgId={currentOrgId}
                />
              </div>
            )}

            <Link href="/products" className="block text-sm hover:underline">
              Browse Products
            </Link>
            <Link
              href="/dashboard/orders"
              className="block text-sm hover:underline"
            >
              My Orders
            </Link>
            <Link
              href="/dashboard/organization"
              className="block text-sm hover:underline"
            >
              Organization
            </Link>
            {userRole === "SELLER" && (
              <Link
                href="/dashboard/my-products"
                className="block text-sm hover:underline"
              >
                My Products
              </Link>
            )}
            {userRole === "ADMIN" && (
              <>
                <Link
                  href="/admin/products"
                  className="block text-sm hover:underline"
                >
                  Admin Products
                </Link>
                <Link
                  href="/admin/organizations"
                  className="block text-sm hover:underline"
                >
                  Admin Organizations
                </Link>
                <Link
                  href="/admin/users"
                  className="block text-sm hover:underline"
                >
                  Admin Users
                </Link>
              </>
            )}
          </nav>
        </aside>

        <main className="flex-1 p-4">{children}</main>
      </div>
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
