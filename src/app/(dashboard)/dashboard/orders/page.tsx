import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/core/db/prisma";
import { getUserOrders } from "@/features/orders/db/orders";
import { PageHeader } from "@/components/PageHeader";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { OrderTableRow } from "@/features/orders/components/OrderTableRow";

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
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((order) => (
              <OrderTableRow key={order.id} order={order} />
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
