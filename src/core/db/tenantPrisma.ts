import {
  ConcurrencyConflictError,
  VersionRequiredError,
  NotFoundError,
} from "@/features/common/errors/domainErrors";
import { prisma } from "./prisma";
import { Prisma, ProductStatus } from "@/generated/prisma/client";

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

      async create(data: {
        title: string;
        slug: string;
        description: string;
        price: number;
      }) {
        return prisma.product.create({
          data: {
            ...data,
            organizationId,
            createdById: userId,
          },
        });
      },

      async update(
        id: string,
        version: number | undefined,
        data: Partial<{
          title: string;
          description: string;
          price: number;
          status?: ProductStatus;
        }>,
      ) {
        if (!version || version < 1) {
          throw new VersionRequiredError();
        }

        const result = await prisma.product.updateMany({
          where: {
            id,
            organizationId,
            version,
            deletedAt: null,
          },
          data: {
            ...data,
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
          include: { optionValues: true },
        });
      },

      async findUnique(id: string) {
        const variant = await prisma.productVariant.findFirst({
          where: { id },
          include: { optionValues: true },
        });

        if (!variant) throw new NotFoundError(`Variant ${id} not found`);

        return variant;
      },

      async create(data: {
        productId: string;
        sku: string;
        price: number;
        stock: number;
      }) {
        return prisma.productVariant.create({ data });
      },

      async update(
        id: string,
        data: Partial<{ sku: string; price: number; stock: number }>,
      ) {
        return prisma.productVariant.update({ where: { id }, data });
      },

      async delete(id: string) {
        await prisma.productVariant.delete({ where: { id } });
      },
    },

    option: {
      async findMany(productId: string) {
        return prisma.variantOption.findMany({
          where: { productId },
          include: { values: true },
        });
      },

      async findUnique(id: string) {
        const option = await prisma.variantOption.findFirst({ where: { id } });

        if (!option) {
          throw new NotFoundError(`Option ${id} not found`);
        }

        return option;
      },

      async create(data: { productId: string; name: string }) {
        return prisma.variantOption.create({ data });
      },

      async update(id: string, data: Partial<{ name: string }>) {
        return prisma.variantOption.update({ where: { id }, data });
      },

      async delete(id: string) {
        await prisma.variantOption.delete({ where: { id } });
      },
    },
    optionValue: {
      async findMany(optionId: string) {
        return prisma.variantOptionValue.findMany({ where: { optionId } });
      },

      async findUnique(id: string) {
        const value = await prisma.variantOptionValue.findFirst({
          where: { id },
        });

        if (!value) {
          throw new NotFoundError(`OptionValue ${id} not found`);
        }

        return value;
      },

      async create(data: {
        optionId: string;
        variantId: string;
        value: string;
      }) {
        return prisma.variantOptionValue.create({ data });
      },

      async update(id: string, data: Partial<{ value: string }>) {
        return prisma.variantOptionValue.update({ where: { id }, data });
      },

      async delete(id: string) {
        await prisma.variantOptionValue.delete({ where: { id } });
      },
    },
  };
}
