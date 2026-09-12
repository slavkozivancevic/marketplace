import {
  ConcurrencyConflictError,
  VersionRequiredError,
  NotFoundError,
} from "@/features/common/errors/domainErrors";
import { prisma } from "./prisma";
import { Prisma, ProductStatus } from "@/generated/prisma/client";
import { moneyCol, priceColumns } from "./moneyColumns";
import type { MoneySet } from "@/lib/money";

/** The `price`/`priceMoney` pair for an update that changes the price. */
function moneyColumns(set: MoneySet) {
  const { mirror, json } = moneyCol(set);
  return { price: mirror, priceMoney: json };
}

export function tenantPrisma({
  organizationId,
  userId,
}: {
  organizationId: string;
  userId: string;
}) {
  if (!organizationId || !userId) {
    throw new Error("Invalid tenant context");
  }

  return {
    prisma,
    product: {
      async findMany(options?: Prisma.ProductFindManyArgs) {
        return prisma.product.findMany({
          ...options,
          where: {
            ...(options?.where ?? {}),
            organizationId,
            deletedAt: null,
          },
        });
      },

      async findFirst(options?: Prisma.ProductFindFirstArgs) {
        return prisma.product.findFirst({
          ...options,
          where: {
            ...(options?.where ?? {}),
            organizationId,
            deletedAt: null,
          },
        });
      },

      async findFirstOrThrow(options?: Prisma.ProductFindFirstArgs) {
        const product = await prisma.product.findFirst({
          ...options,
          where: {
            ...(options?.where ?? {}),
            organizationId,
            deletedAt: null,
          },
        });

        if (!product) {
          throw new NotFoundError("Product not found");
        }

        return product;
      },

      async findUnique(id: string) {
        const product = await prisma.product.findFirst({
          where: { id, organizationId, deletedAt: null },
        });
        if (!product) throw new NotFoundError(`Product ${id} not found`);
        return product;
      },

      // Money goes in as a MoneySet, never a bare mirror: `priceColumns` writes
      // the Int and the Json together, which is what `Product.priceMoney` being
      // NOT NULL enforces. See src/core/db/moneyColumns.ts.
      async create(data: { price: MoneySet }) {
        return prisma.product.create({
          data: {
            ...priceColumns(data),
            organizationId,
            createdById: userId,
          },
        });
      },

      async update(
        id: string,
        version: number | undefined,
        data: Partial<{
          price: MoneySet;
          status?: ProductStatus;
        }>,
      ) {
        if (!version || version < 1) {
          throw new VersionRequiredError();
        }

        const { price, ...rest } = data;
        const result = await prisma.product.updateMany({
          where: {
            id,
            organizationId,
            version,
            deletedAt: null,
          },
          data: {
            ...rest,
            ...(price ? moneyColumns(price) : {}),
            updatedById: userId,
            version: { increment: 1 },
          },
        });

        if (result.count === 0) {
          throw new ConcurrencyConflictError();
        }

        const updated = prisma.product.findFirstOrThrow({
          where: {
            id,
            organizationId,
            deletedAt: null,
            version: version + 1,
          },
        });

        if (!updated) {
          throw new NotFoundError(`Product ${id} not found after update`);
        }

        return updated;
      },

      async delete(id: string) {
        const result = await prisma.product.updateMany({
          where: {
            id,
            organizationId,
            deletedAt: null,
          },
          data: {
            deletedAt: new Date(),
            updatedById: userId,
          },
        });

        if (result.count === 0) {
          throw new NotFoundError(`Product ${id} not found`);
        }
      },
    },
    variant: {
      async findMany(productId: string) {
        return prisma.productVariant.findMany({
          where: { productId },
          include: { attributeValues: true },
        });
      },

      async findUnique(id: string) {
        const variant = await prisma.productVariant.findFirst({
          where: { id },
          include: { attributeValues: true },
        });

        if (!variant) throw new NotFoundError(`Variant ${id} not found`);

        return variant;
      },

      async create(data: {
        productId: string;
        sku: string;
        price: MoneySet;
        stock: number;
      }) {
        return prisma.productVariant.create({
          data: { ...data, ...priceColumns(data) },
        });
      },

      async update(
        id: string,
        data: Partial<{ sku: string; price: MoneySet; stock: number }>,
      ) {
        const { price, ...rest } = data;
        return prisma.productVariant.update({
          where: { id },
          data: { ...rest, ...(price ? moneyColumns(price) : {}) },
        });
      },

      async delete(id: string) {
        await prisma.productVariant.delete({ where: { id } });
      },
    },
  };
}
