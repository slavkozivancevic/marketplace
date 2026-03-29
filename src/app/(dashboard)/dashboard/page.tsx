import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/core/db/prisma";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default async function DashboardPage() {
  const { userId } = await auth();

  const user = await prisma.user.findUnique({
    where: { clerkUserId: userId! },
    select: { role: true, name: true },
  });

  const userRole = user?.role ?? "USER";

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8">
        Welcome, {user?.name || "User"}!
      </h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Browse Products</CardTitle>
            <CardDescription>
              Discover products from our marketplace.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/products">View Products</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Organization</CardTitle>
            <CardDescription>
              Manage your organization settings and members.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/dashboard/organization">Settings</Link>
            </Button>
          </CardContent>
        </Card>

        {userRole === "SELLER" && (
          <Card>
            <CardHeader>
              <CardTitle>My Products</CardTitle>
              <CardDescription>Manage your products.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link href="/dashboard/my-products">Manage Products</Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {userRole === "ADMIN" && (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Admin Products</CardTitle>
                <CardDescription>Manage all platform products.</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild>
                  <Link href="/admin/products">Manage Products</Link>
                </Button>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Admin Organizations</CardTitle>
                <CardDescription>
                  Verify and manage organizations.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild>
                  <Link href="/admin/organizations">Manage Organizations</Link>
                </Button>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Admin Users</CardTitle>
                <CardDescription>Manage users and platform.</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild>
                  <Link href="/admin/users">Manage Users</Link>
                </Button>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
