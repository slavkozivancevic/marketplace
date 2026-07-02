import { describe, it, expect, beforeEach } from "vitest";
import { createCodOrder } from "./orders";
import { InsufficientStockError } from "@/features/common/errors/domainErrors";
import {
  prisma,
  resetDb,
  createUser,
  createOrganization,
  createProduct,
  createVariant,
} from "../../../../test/integration/helpers";

const SHIPPING = {
  name: "Test Buyer",
  line1: "Zemunska 15",
  line2: null,
  city: "Belgrade",
  state: null,
  postalCode: "11000",
  country: "RS",
};

beforeEach(async () => {
  await resetDb();
});

describe("createCodOrder - stock guard", () => {
  it("creates the order and atomically decrements product stock", async () => {
    const user = await createUser();
    const org = await createOrganization();
    const product = await createProduct({ organizationId: org.id, price: 1000, stock: 5 });

    const order = await createCodOrder({
      userId: user.id,
      totalInCurrency: 2000,
      currency: "usd",
      exchangeRate: 1,
      items: [{ productId: product.id, variantId: null, quantity: 2 }],
      shipping: SHIPPING,
    });

    expect(order.id).toBeTruthy();
    const after = await prisma.product.findUnique({ where: { id: product.id } });
    expect(after?.stock).toBe(3);

    // The order line item was persisted.
    const itemCount = await prisma.orderItem.count({ where: { orderId: order.id } });
    expect(itemCount).toBe(1);
  });

  it("throws and rolls back when quantity exceeds stock", async () => {
    const user = await createUser();
    const org = await createOrganization();
    const product = await createProduct({ organizationId: org.id, price: 1000, stock: 1 });

    await expect(
      createCodOrder({
        userId: user.id,
        totalInCurrency: 3000,
        currency: "usd",
        exchangeRate: 1,
        items: [{ productId: product.id, variantId: null, quantity: 3 }],
        shipping: SHIPPING,
      }),
    ).rejects.toBeInstanceOf(InsufficientStockError);

    // Stock untouched and no order created (transaction rolled back).
    const after = await prisma.product.findUnique({ where: { id: product.id } });
    expect(after?.stock).toBe(1);
    expect(await prisma.order.count()).toBe(0);
  });

  it("decrements variant stock for a variant line", async () => {
    const user = await createUser();
    const org = await createOrganization();
    const product = await createProduct({ organizationId: org.id, price: 1000, stock: null });
    const variant = await createVariant({ productId: product.id, price: 1500, stock: 4 });

    await createCodOrder({
      userId: user.id,
      totalInCurrency: 3000,
      currency: "usd",
      exchangeRate: 1,
      items: [{ productId: product.id, variantId: variant.id, quantity: 2 }],
      shipping: SHIPPING,
    });

    const after = await prisma.productVariant.findUnique({ where: { id: variant.id } });
    expect(after?.stock).toBe(2);
  });
});
