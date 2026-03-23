import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
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

  const user = await prisma.user.findUnique({
    where: { clerkUserId: userId },
    select: { role: true },
  });

  const userRole = user?.role ?? "USER";

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <div className="flex flex-1">
        <aside className="w-64 border-r p-6">
          <nav className="space-y-2">
            <h2 className="font-semibold mb-4">Dashboard</h2>
            {/* <Link href="/dashboard" className="block text-sm hover:underline">
              Home
            </Link> */}
            <Link href="/products" className="block text-sm hover:underline">
              Browse Products
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
