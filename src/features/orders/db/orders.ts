import { prisma } from "@/core/db/prisma";
import { cacheTag } from "next/cache";
import { CacheTags } from "@/lib/cache/tags";
import { revalidateOrderCache } from "./cache";

export async function getUserOrders(userId: string) {
  "use cache";
  cacheTag(CacheTags.orders.byUser(userId));

  const orders = await prisma.order.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: {
      items: {
        include: {
          product: { select: { title: true } },
          variant: { select: { sku: true } },
        },
      },
    },
  });

  return orders.map((order) => ({
    ...order,
    total: Number(order.total),
    items: order.items.map((item) => ({
      ...item,
      price: Number(item.price),
    })),
  }));
}

export async function getOrderById(id: string, userId: string) {
  "use cache";
  cacheTag(CacheTags.orders.byId(id));

  const order = await prisma.order.findFirst({
    where: { id, userId },
    include: {
      items: {
        include: {
          product: {
            select: {
              id: true,
              title: true,
              images: { orderBy: { order: "asc" }, take: 1 },
            },
          },
          variant: { select: { sku: true, optionValues: true } },
        },
      },
    },
  });

  if (!order) return null;

  return {
    ...order,
    total: Number(order.total),
    items: order.items.map((item) => ({
      ...item,
      price: Number(item.price),
    })),
  };
}

export type FulfillOrderItem = {
  productId: string;
  variantId: string | null;
  quantity: number;
};

export async function fulfillOrder({
  userId,
  stripeSessionId,
  totalCents,
  items,
}: {
  userId: string;
  stripeSessionId: string;
  totalCents: number;
  items: FulfillOrderItem[];
}) {
  const existing = await prisma.order.findUnique({
    where: { stripeSessionId },
  });

  if (existing) {
    console.log(
      `Order for session ${stripeSessionId} already exists, skipping`,
    );
    return existing;
  }

  return prisma.$transaction(async (tx) => {
    const order = await tx.order.create({
      data: {
        userId,
        stripeSessionId,
        status: "COMPLETED",
        total: totalCents / 100,
        items: {
          create: await Promise.all(
            items.map(async (item) => {
              let price: number;

              if (item.variantId) {
                const variant = await tx.productVariant.findUniqueOrThrow({
                  where: { id: item.variantId },
                });
                price = Number(variant.price);

                await tx.productVariant.update({
                  where: { id: item.variantId },
                  data: { stock: { decrement: item.quantity } },
                });
              } else {
                const product = await tx.product.findUniqueOrThrow({
                  where: { id: item.productId },
                });
                price = Number(product.price);
              }

              return {
                productId: item.productId,
                variantId: item.variantId,
                quantity: item.quantity,
                price,
              };
            }),
          ),
        },
      },
    });

    revalidateOrderCache(userId, order.id);
    return order;
  });
}

export async function refundOrder(stripeSessionId: string) {
  const order = await prisma.order.findUnique({
    where: { stripeSessionId },
    include: {
      items: { select: { variantId: true, quantity: true } },
    },
  });

  if (!order) {
    console.log(`No order found for session ${stripeSessionId}, skipping refund`);
    return null;
  }

  if (order.status === "REFUNDED") {
    console.log(`Order ${order.id} already refunded, skipping`);
    return order;
  }

  return prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: order.id },
      data: { status: "REFUNDED" },
    });

    for (const item of order.items) {
      if (item.variantId) {
        await tx.productVariant.update({
          where: { id: item.variantId },
          data: { stock: { increment: item.quantity } },
        });
      }
    }

    revalidateOrderCache(order.userId, order.id);
    return order;
  });
}
