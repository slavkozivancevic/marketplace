import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/core/db/prisma";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/PageHeader";
import Link from "next/link";

export default async function MyProductsPage() {
  const { userId } = await auth();

  const user = await prisma.user.findUnique({
    where: { clerkUserId: userId! },
    select: { id: true, role: true },
  });

  if (!user || user.role !== "SELLER") {
    redirect("/dashboard");
  }

  const products = await prisma.product.findMany({
    where: { createdById: user.id, deletedAt: null },
    include: { images: { take: 1 } },
  });

  return (
    <div className="container">
      <PageHeader
        title="My Products"
        description="Manage your product listings."
      >
        <Button asChild>
          <Link href="/dashboard/my-products/new">Create Product</Link>
        </Button>
      </PageHeader>

      {products.length === 0 ? (
        <p className="text-muted-foreground">
          No products yet. Create your first product!
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map((product) => (
            <div key={product.id} className="border rounded p-4">
              <h2 className="font-semibold">{product.title}</h2>
              <p className="text-sm text-muted-foreground">
                {product.description}
              </p>
              <p className="text-sm">${Number(product.price).toFixed(2)}</p>
              <p className="text-sm">Status: {product.status}</p>
              <Button asChild variant="outline" className="mt-2">
                <Link href={`/dashboard/my-products/${product.id}`}>Edit</Link>
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
