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
import Image from "next/image";

export default async function ProductsPage() {
  const products = await prisma.product.findMany({
    where: { status: "PUBLISHED", deletedAt: null },
    include: { images: { orderBy: { order: "asc" }, take: 1 } },
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
              {product.images[0] && (
                <CardHeader className="p-0">
                  <Image
                    src={product.images[0].url}
                    alt={product.title}
                    width={300}
                    height={200}
                    className="w-full h-48 object-cover rounded-t"
                  />
                </CardHeader>
              )}
              <CardContent className="pt-4">
                <CardTitle>{product.title}</CardTitle>
                <CardDescription>{product.description}</CardDescription>
                <p className="text-lg font-semibold mt-2">
                  ${Number(product.price).toFixed(2)}
                </p>
                <Button className="mt-4">View Details</Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
