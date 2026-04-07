import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/core/db/prisma";
import { getUserOrders } from "@/features/orders/db/orders";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default async function OrdersPage() {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) notFound();

  const user = await prisma.user.findUnique({
    where: { clerkUserId },
    select: { id: true },
  });
  if (!user) notFound();

  const orders = await getUserOrders(user.id);

  return (
    <div className="container">
      <PageHeader title="My Orders" description="Your purchase history." />

      {orders.length === 0 ? (
        <Alert>
          <AlertTitle>No orders yet</AlertTitle>
          <AlertDescription>
            You haven&apos;t placed any orders yet.{" "}
            <Link href="/products" className="underline">
              Browse products
            </Link>
          </AlertDescription>
        </Alert>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Items</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((order) => (
              <TableRow key={order.id}>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {order.id.slice(0, 8)}...
                </TableCell>
                <TableCell>
                  {new Date(order.createdAt).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  {order.items.map((item) => (
                    <div key={item.id} className="text-sm">
                      {item.product.title}
                      {item.variant && (
                        <span className="text-muted-foreground">
                          {" "}· {item.variant.sku}
                        </span>
                      )}
                      {item.quantity > 1 && (
                        <span className="text-muted-foreground">
                          {" "}× {item.quantity}
                        </span>
                      )}
                    </div>
                  ))}
                </TableCell>
                <TableCell className="font-semibold">
                  ${order.total.toFixed(2)}
                </TableCell>
                <TableCell>
                  <Badge variant={getStatusVariant(order.status)}>
                    {order.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/dashboard/orders/${order.id}`}>Details</Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
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
