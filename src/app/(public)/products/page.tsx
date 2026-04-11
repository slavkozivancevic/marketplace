import { connection } from "next/server";
import Link from "next/link";
import { prisma } from "@/core/db/prisma";
import { PageHeader } from "@/components/PageHeader";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { HoverImageCycler } from "@/components/product/HoverImageCycler";

export default async function ProductsPage() {
  await connection();
  const products = await prisma.product.findMany({
    where: { status: "PUBLISHED", deletedAt: null },
    include: { images: { orderBy: { order: "asc" }, take: 5 } },
  });

  return (
    <div className="container">
      <PageHeader
        title="Products"
        description="Browse our available products."
      />

      {products.length === 0 ? (
        <Alert>
          <AlertTitle>No products available</AlertTitle>
          <AlertDescription>
            Check back later for new products.
          </AlertDescription>
        </Alert>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map((product) => (
            <Card key={product.id}>
              {product.images.length > 0 && (
                <CardHeader className="p-0">
                  <HoverImageCycler
                    images={product.images.map((img) => img.url)}
                    alt={product.title}
                    className="w-full h-48 rounded-t"
                  />
                </CardHeader>
              )}
              <CardContent className="pt-4">
                <CardTitle>{product.title}</CardTitle>
                <CardDescription>{product.description}</CardDescription>
                <p className="text-lg font-semibold mt-2">
                  ${Number(product.price).toFixed(2)}
                </p>
                <Button asChild className="mt-4">
                  <Link href={`/products/${product.id}`}>View Details</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
