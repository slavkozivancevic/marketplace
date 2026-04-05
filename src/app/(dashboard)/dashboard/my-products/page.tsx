import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/core/db/prisma";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/PageHeader";
import Link from "next/link";
import { MyProductCard } from "@/features/products/components/MyProductCard";

export default async function MyProductsPage() {
  const { userId } = await auth();

  const user = await prisma.user.findUnique({
    where: { clerkUserId: userId! },
    select: {
      id: true,
      role: true,
      activeOrgId: true,
      memberships: {
        select: { orgId: true, role: true },
      },
    },
  });

  if (!user || user.role !== "SELLER") {
    redirect("/dashboard");
  }

  if (!user.activeOrgId) {
    redirect("/dashboard");
  }

  const activeMembership = user.memberships.find(
    (m) => m.orgId === user.activeOrgId,
  );

  const canWrite =
    activeMembership?.role === "OWNER" || activeMembership?.role === "ADMIN";

  const products = await prisma.product.findMany({
    where: {
      organizationId: user.activeOrgId,
      deletedAt: null,
    },
    include: { images: { take: 1, orderBy: { order: "asc" } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="container">
      <PageHeader
        title="My Products"
        description="Manage your product listings."
      >
        {canWrite && (
          <Button asChild>
            <Link href="/dashboard/my-products/new">Create Product</Link>
          </Button>
        )}
      </PageHeader>

      {products.length === 0 ? (
        <p className="text-muted-foreground">
          No products yet.{canWrite ? " Create your first product!" : ""}
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map((product) => (
            <MyProductCard
              key={product.id}
              canWrite={canWrite}
              product={{
                id: product.id,
                title: product.title,
                description: product.description,
                price: Number(product.price),
                status: product.status,
                imageUrl: product.images[0]?.url ?? null,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
