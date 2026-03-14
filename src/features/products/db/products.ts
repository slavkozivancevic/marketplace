import { tenantPrisma } from "@/core/db/tenantPrisma";
import { revalidateProductCache } from "./cache";
import {
  ImageInput,
  ProductVariantInput,
  RequestContext,
  VariantOptionInput,
} from "@/types/types";
import { Prisma, ProductStatus } from "@/generated/prisma/client";
import {
  ConcurrencyConflictError,
  NotFoundError,
  VersionRequiredError,
} from "@/features/common/errors/domainErrors";
import { emitProductEvent } from "@/features/webhooks/productEvents";
import { deleteS3Object } from "@/services/s3Delete";
import { env } from "@/env/server";

const S3_BASE = env.S3_PUBLIC_URL!;

async function syncProductImages(
  tx: Prisma.TransactionClient,
  productId: string,
  images: ImageInput[],
) {
  const existing = await tx.productImage.findMany({
    where: { productId },
    orderBy: { order: "asc" },
  });

  const existingMap = new Map<string, (typeof existing)[number]>(
    existing.map((img) => [img.key, img]),
  );

  const incomingKeys = new Set(images.map((img) => img.key));

  const toDelete = existing.filter((img) => !incomingKeys.has(img.key));
  if (toDelete.length > 0) {
    await tx.productImage.deleteMany({
      where: {
        productId,
        key: { in: toDelete.map((img) => img.key) },
      },
    });

    await Promise.all(
      toDelete.map((img) => deleteS3Object(img.key).catch(() => {})),
    );
  }

  const toInsert = images.filter((img) => !existingMap.has(img.key));

  if (toInsert.length > 0) {
    await tx.productImage.createMany({
      data: toInsert.map((img, index) => ({
        productId,
        key: img.key,
        url: `${S3_BASE}/${img.key}`,
        order: index,
      })),
    });
  }

  const reorderOperations = images
    .map((img, index) => {
      const existingImg = existingMap.get(img.key);

      if (!existingImg || existingImg.order === index) {
        return null;
      }

      return tx.productImage.updateMany({
        where: { productId, key: img.key },
        data: { order: index },
      });
    })
    .filter(
      (op): op is ReturnType<typeof tx.productImage.updateMany> => op !== null,
    );

  if (reorderOperations.length > 0) {
    await Promise.all(reorderOperations);
  }
}

async function syncVariants(
  tx: Prisma.TransactionClient,
  productId: string,
  variants: ProductVariantInput[],
) {
  const existing = await tx.productVariant.findMany({ where: { productId } });
  const existingMap = new Map(existing.map((v) => [v.sku, v]));

  const incomingSkus = new Set(variants.map((v) => v.sku));

  const toDelete = existing.filter((v) => !incomingSkus.has(v.sku));
  if (toDelete.length > 0) {
    await tx.productVariant.deleteMany({
      where: { productId, sku: { in: toDelete.map((v) => v.sku) } },
    });
  }

  for (const variant of variants) {
    const existingVariant = existingMap.get(variant.sku);
    if (existingVariant) {
      await tx.productVariant.update({
        where: { id: existingVariant.id },
        data: {
          price: variant.price,
          stock: variant.stock,
          updatedAt: new Date(),
        },
      });
      variant.id = existingVariant.id;
    } else {
      const created = await tx.productVariant.create({
        data: {
          productId,
          sku: variant.sku,
          price: variant.price,
          stock: variant.stock,
        },
      });
      variant.id = created.id;
    }
  }
}

async function syncOptions(
  tx: Prisma.TransactionClient,
  productId: string,
  options: VariantOptionInput[],
  variants: ProductVariantInput[],
) {
  const existingOptions = await tx.variantOption.findMany({
    where: { productId },
  });
  const existingMap = new Map(existingOptions.map((o) => [o.name, o]));

  const incomingOptionNames = new Set(options.map((o) => o.name));

  const toDelete = existingOptions.filter(
    (o) => !incomingOptionNames.has(o.name),
  );
  for (const del of toDelete) {
    await tx.variantOptionValue.deleteMany({ where: { optionId: del.id } });
    await tx.variantOption.delete({ where: { id: del.id } });
  }

  for (const option of options) {
    let optionId = existingMap.get(option.name)?.id;
    if (!optionId) {
      const createdOption = await tx.variantOption.create({
        data: { productId, name: option.name },
      });
      optionId = createdOption.id;
    }

    const existingValues = await tx.variantOptionValue.findMany({
      where: { optionId },
    });
    const existingValueMap = new Map(existingValues.map((v) => [v.value, v]));

    const incomingValues = new Set(option.values);
    const toDeleteValues = existingValues.filter(
      (v) => !incomingValues.has(v.value),
    );
    await tx.variantOptionValue.deleteMany({
      where: { id: { in: toDeleteValues.map((v) => v.id) } },
    });

    for (const val of option.values) {
      if (!existingValueMap.has(val)) {
        let variantId: string | undefined;
        for (const variant of variants) {
          if (
            variant.options?.some(
              (o) => o.name === option.name && o.value === val,
            )
          ) {
            variantId = variant.id;
            break;
          }
        }
        await tx.variantOptionValue.create({
          data: { optionId, value: val, variantId: variantId! },
        });
      }
    }
  }
}

export function productRepository(ctx: RequestContext) {
  const db = tenantPrisma({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
  });

  type SortField = "createdAt" | "price" | "title" | "status";
  type SortOrder = "asc" | "desc";

  return {
    async getById(id: string) {
      // "use cache";

      // cacheTag(getProductGlobalTag(db.organizationId));
      // cacheTag(getProductIdTag(db.organizationId, id));

      return db.product.findFirst({
        where: { id },
        include: {
          images: true,
          variants: true,
          options: { include: { values: true } },
        },
      });
    },

    async getAll(params?: {
      take?: number;
      cursor?: string;
      status?: ProductStatus;
      minPrice?: number;
      maxPrice?: number;
      createdBy?: string;
      updatedBy?: string;
      search?: string;
      sortBy?: SortField;
      sortOrder?: SortOrder;
    }) {
      // "use cache";

      // cacheTag(getProductGlobalTag(db.organizationId));

      const take = params?.take ?? 20;
      const cursor = params?.cursor;
      const where: Prisma.ProductWhereInput = { deletedAt: null };

      if (params?.status) where.status = params.status;
      if (params?.minPrice || params?.maxPrice) {
        where.price = {};
        if (params.minPrice != null) where.price.gte = params.minPrice;
        if (params.maxPrice != null) where.price.lte = params.maxPrice;
      }
      if (params?.createdBy) where.createdById = params.createdBy;
      if (params?.updatedBy) where.updatedById = params.updatedBy;

      if (params?.search) {
        where.OR = [
          { title: { contains: params.search, mode: "insensitive" } },
          { description: { contains: params.search, mode: "insensitive" } },
        ];
      }

      const orderBy: Prisma.ProductOrderByWithRelationInput = {};
      if (params?.sortBy) {
        orderBy[params.sortBy] = params.sortOrder ?? "asc";
      } else {
        orderBy.createdAt = "desc";
      }

      const products = await db.product.findMany({
        where,
        orderBy,
        take: take + 1,
        cursor: cursor ? { id: cursor } : undefined,
        skip: cursor ? 1 : 0,
        include: {
          images: {
            take: 1,
            orderBy: { order: "asc" },
          },
        },
      });

      let nextCursor: string | undefined = undefined;
      if (products.length > take) {
        nextCursor = products.pop()!.id;
      }

      return { products, nextCursor };
    },

    async create(data: {
      title: string;
      description: string;
      price: number;
      images?: ImageInput[];
      variants?: ProductVariantInput[];
      options?: VariantOptionInput[];
    }) {
      const product = await db.prisma.$transaction(async (tx) => {
        const created = await tx.product.create({
          data: {
            title: data.title,
            description: data.description,
            price: data.price,
            organizationId: ctx.organizationId,
            createdById: ctx.userId,
          },
        });

        if (data?.images?.length) {
          await syncProductImages(tx, created.id, data.images);
        }
        if (data?.variants?.length) {
          await syncVariants(tx, created.id, data.variants);
        }
        if (data?.options?.length) {
          await syncOptions(tx, created.id, data.options, data.variants ?? []);
        }

        await tx.productHistory.create({
          data: {
            productId: created.id,
            version: 1,
            title: created.title,
            description: created.description,
            price: created.price,
            status: created.status,
            updatedById: ctx.userId,
          },
        });

        await emitProductEvent(tx, "product.created");

        return tx.product.findFirstOrThrow({
          where: { id: created.id },
          include: {
            images: true,
            variants: true,
            options: { include: { values: true } },
          },
        });
      });

      revalidateProductCache(ctx.organizationId, product.id);

      return product;
    },

    async update(
      id: string,
      version: number,
      data: Partial<{
        title: string;
        description: string;
        price: number;
        images?: ImageInput[];
        status?: ProductStatus;
        variants?: ProductVariantInput[];
        options?: VariantOptionInput[];
      }>,
    ) {
      const product = await db.prisma.$transaction(async (tx) => {
        if (!version || version < 1) {
          throw new VersionRequiredError();
        }

        const result = await tx.product.updateMany({
          where: {
            id,
            organizationId: ctx.organizationId,
            version,
            deletedAt: null,
          },
          data: {
            ...data,
            updatedById: ctx.userId,
            version: { increment: 1 },
          },
        });

        if (result.count === 0) {
          throw new ConcurrencyConflictError();
        }

        if (data.images !== undefined) {
          await syncProductImages(tx, id, data.images);
        }
        if (data.variants !== undefined)
          await syncVariants(tx, id, data.variants);
        if (data.options !== undefined)
          await syncOptions(tx, id, data.options, data.variants ?? []);

        const updated = await tx.product.findFirstOrThrow({
          where: {
            id,
            organizationId: ctx.organizationId,
            deletedAt: null,
            version: version + 1,
          },
          include: {
            images: true,
            variants: true,
            options: { include: { values: true } },
          },
        });

        await tx.productHistory.create({
          data: {
            productId: updated.id,
            version: updated.version,
            title: updated.title,
            description: updated.description,
            price: updated.price,
            status: updated.status,
            updatedById: ctx.userId,
          },
        });

        await emitProductEvent(tx, "product.updated");

        return updated;
      });

      revalidateProductCache(ctx.organizationId, id);

      return product;
    },

    async delete(id: string) {
      const images = await db.prisma.productImage.findMany({
        where: { productId: id },
        select: { key: true },
      });

      await db.product.delete(id);

      await emitProductEvent(db.prisma, "product.deleted");

      if (images.length > 0) {
        await Promise.all(
          images.map((img) => deleteS3Object(img.key).catch(() => {})),
        );
      }

      revalidateProductCache(ctx.organizationId, id);
    },

    async getHistory(productId: string) {
      return db.prisma.productHistory.findMany({
        where: { productId },
        orderBy: { version: "desc" },
        include: { updatedBy: true },
      });
    },

    async rollbackToVersion(productId: string, targetVersion: number) {
      const history = await db.prisma.productHistory.findFirst({
        where: { productId, version: targetVersion },
      });
      if (!history)
        throw new NotFoundError(`Version ${targetVersion} not found`);

      return this.update(productId, history.version - 1, {
        title: history.title,
        description: history.description,
        price: Number(history.price),
        status: history.status,
      });
    },

    async previewVersion(productId: string, version: number) {
      const history = await db.prisma.productHistory.findFirst({
        where: { productId, version },
      });
      if (!history) throw new NotFoundError(`Version ${version} not found`);
      return history;
    },

    async bulkUpdateStatus(productIds: string[], status: ProductStatus) {
      if (!productIds.length) return [];

      const updatedProducts = await db.prisma.$transaction(async (tx) => {
        const products = await tx.product.findMany({
          where: {
            id: { in: productIds },
            organizationId: ctx.organizationId,
            deletedAt: null,
          },
        });

        if (products.length === 0) {
          throw new NotFoundError("No products found for bulk update");
        }

        const results = [];

        for (const product of products) {
          const updated = await tx.product.update({
            where: { id: product.id },
            data: {
              status,
              updatedById: ctx.userId,
              version: { increment: 1 },
            },
          });

          await tx.productHistory.create({
            data: {
              productId: updated.id,
              version: updated.version,
              title: updated.title,
              description: updated.description,
              price: updated.price,
              status: updated.status,
              updatedById: ctx.userId,
            },
          });

          await emitProductEvent(tx, "product.status.changed");

          results.push(updated);
        }

        return results;
      });

      for (const product of updatedProducts) {
        revalidateProductCache(ctx.organizationId, product.id);
      }

      return updatedProducts;
    },

    async bulkDelete(productIds: string[]) {
      if (!productIds.length) return;

      const images = await db.prisma.productImage.findMany({
        where: {
          productId: { in: productIds },
        },
        select: {
          key: true,
          productId: true,
        },
      });

      await db.prisma.product.updateMany({
        where: {
          id: { in: productIds },
          organizationId: ctx.organizationId,
          deletedAt: null,
        },
        data: {
          deletedAt: new Date(),
        },
      });

      await emitProductEvent(db.prisma, "product.deleted");

      if (images.length > 0) {
        await Promise.all(
          images.map((img) => deleteS3Object(img.key).catch(() => {})),
        );
      }

      for (const id of productIds) {
        revalidateProductCache(ctx.organizationId, id);
      }
    },
  };
}
