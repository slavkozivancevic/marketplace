import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/core/db/prisma";
import { getOrderById } from "@/features/orders/db/orders";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

interface OrderDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function OrderDetailPage({
  params,
}: OrderDetailPageProps) {
  const { id } = await params;
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) notFound();

  const user = await prisma.user.findUnique({
    where: { clerkUserId },
    select: { id: true },
  });
  if (!user) notFound();

  const order = await getOrderById(id, user.id);
  if (!order) notFound();

  return (
    <div className="container max-w-2xl">
      <PageHeader
        title={`Order Details`}
        description={`Placed on ${new Date(order.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}`}
      >
        <Button asChild variant="outline">
          <Link href="/dashboard/orders">Back to Orders</Link>
        </Button>
      </PageHeader>

      <div className="space-y-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Order Summary</CardTitle>
            <Badge variant={getStatusVariant(order.status)}>
              {order.status}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Order ID</span>
              <span className="font-mono">{order.id}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Stripe Session</span>
              <span className="font-mono text-xs">{order.stripeSessionId}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Items</CardTitle>
          </CardHeader>
          <CardContent className="space-y-0">
            {order.items.map((item, index) => {
              const variantImageUrl =
                item.variant?.images[0]?.image.url ?? null;
              const imageUrl =
                variantImageUrl ?? item.product.images[0]?.url ?? null;
              const variantLabel = item.variant?.optionValues
                .map((ov) => ov.value)
                .join(" / ");

              return (
                <div key={item.id}>
                  {index > 0 && <Separator className="my-3" />}
                  <div className="flex gap-4 items-center">
                    <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded border">
                      {imageUrl ? (
                        <Image
                          src={imageUrl}
                          alt={item.product.title}
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <div className="h-full w-full bg-muted" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">
                        {item.product.title}
                      </p>
                      {variantLabel && (
                        <p className="text-xs text-muted-foreground">
                          {variantLabel}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        ${item.price.toFixed(2)} × {item.quantity}
                      </p>
                    </div>
                    <p className="font-semibold text-sm">
                      ${(item.price * item.quantity).toFixed(2)}
                    </p>
                  </div>
                </div>
              );
            })}

            <Separator className="my-4" />
            <div className="flex justify-between font-semibold">
              <span>Total</span>
              <span>${order.total.toFixed(2)}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function getStatusVariant(status: string) {
  switch (status) {
    case "COMPLETED":
      return "default" as const;
    case "CANCELLED":
    case "REFUNDED":
      return "destructive" as const;
    default:
      return "secondary" as const;
  }
}
