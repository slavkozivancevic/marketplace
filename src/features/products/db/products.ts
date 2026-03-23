import { tenantPrisma } from "@/core/db/tenantPrisma";
import { revalidateProductCache } from "./cache";
import {
  ImageInput,
  ProductListItem,
  ProductVariantInput,
  ProductWithRelations,
  RequestContext,
  VariantOptionInput,
} from "@/types/types";
import {
  Prisma,
  Product,
  ProductHistory,
  ProductStatus,
} from "@/generated/prisma/client";
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

function resolveVariantIdForOptionValue(
  optionName: string,
  optionValue: string,
  variants: ProductVariantInput[],
): string | undefined {
  for (const variant of variants) {
    if (
      variant.options?.some(
        (o) => o.name === optionName && o.value === optionValue,
      )
    ) {
      return variant.id;
    }
  }
  return undefined;
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

    if (toDeleteValues.length > 0) {
      await tx.variantOptionValue.deleteMany({
        where: { id: { in: toDeleteValues.map((v) => v.id) } },
      });
    }

    for (const val of option.values) {
      const variantId = resolveVariantIdForOptionValue(
        option.name,
        val,
        variants,
      );

      if (!variantId) {
        continue;
      }

      const existingValue = existingValueMap.get(val);

      if (existingValue) {
        if (existingValue.variantId !== variantId) {
          await tx.variantOptionValue.update({
            where: { id: existingValue.id },
            data: { variantId },
          });
        }
      } else {
        await tx.variantOptionValue.create({
          data: { optionId, value: val, variantId },
        });
      }
    }
  }
}

export function productRepository(
  ctx: Pick<RequestContext, "organizationId" | "userId">,
) {
  const db = tenantPrisma({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
  });

  type SortField = "createdAt" | "price" | "title" | "status";
  type SortOrder = "asc" | "desc";

  return {
    // READ
    async getById(id: string): Promise<ProductWithRelations | null> {
      // "use cache";
      // cacheTag(getProductGlobalTag(db.organizationId));
      // cacheTag(getProductIdTag(db.organizationId, id));

      return db.prisma.product.findFirst({
        where: {
          id,
          organizationId: ctx.organizationId,
          deletedAt: null,
        },
        include: {
          images: true,
          variants: {
            include: {
              optionValues: true,
            },
          },
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
    }): Promise<{
      products: ProductListItem[];
      nextCursor?: string;
    }> {
      // "use cache";
      // cacheTag(getProductGlobalTag(db.organizationId));

      const take = params?.take ?? 20;
      const cursor = params?.cursor;

      const where: Prisma.ProductWhereInput = {
        organizationId: ctx.organizationId,
        deletedAt: null,
      };

      if (params?.status) where.status = params.status;

      if (params?.minPrice != null || params?.maxPrice != null) {
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

      const orderBy: Prisma.ProductOrderByWithRelationInput[] = params?.sortBy
        ? [{ [params.sortBy]: params.sortOrder ?? "asc" }, { id: "asc" }]
        : [{ createdAt: "desc" }, { id: "asc" }];

      const products = await db.prisma.product.findMany({
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
          // variants: true,
          // options: { include: { values: true } },
        },
      });

      let nextCursor: string | undefined;
      if (products.length > take) {
        const nextItem = products.pop();
        nextCursor = nextItem?.id;
      }

      return {
        products,
        nextCursor,
      };
    },

    async getHistory(productId: string): Promise<ProductHistory[]> {
      // "use cache";
      // cacheTag(getProductGlobalTag(db.organizationId));
      // cacheTag(getProductIdTag(db.organizationId, productId));
      return db.prisma.productHistory.findMany({
        where: {
          productId,
          product: {
            organizationId: ctx.organizationId,
            deletedAt: null,
          },
        },
        orderBy: { version: "desc" },
        // include: { updatedBy: true },
      });
    },

    async previewVersion(productId: string, version: number) {
      // "use cache";
      // cacheTag(getProductGlobalTag(db.organizationId));
      // cacheTag(getProductIdTag(db.organizationId, productId));

      const history = await db.prisma.productHistory.findFirst({
        where: {
          productId,
          version,
          product: {
            organizationId: ctx.organizationId,
            deletedAt: null,
          },
        },
      });

      if (!history) {
        throw new NotFoundError(`Version ${version} not found`);
      }

      return history;
    },

    // WRITE
    async create(data: {
      title: string;
      description: string;
      price: number;
      images?: ImageInput[];
      variants?: ProductVariantInput[];
      options?: VariantOptionInput[];
    }): Promise<ProductWithRelations> {
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

        const createdProduct = await tx.product.findFirst({
          where: {
            id: created.id,
            organizationId: ctx.organizationId,
            deletedAt: null,
          },
          include: {
            images: true,
            // variants: true,
            variants: {
              include: {
                optionValues: true,
              },
            },
            options: { include: { values: true } },
          },
        });

        if (!createdProduct) {
          throw new NotFoundError(
            `Product ${created.id} not found after create`,
          );
        }

        return createdProduct;
      });

      revalidateProductCache(ctx.organizationId, product.id);

      return product;
    },

    async update(
      id: string,
      version: number | undefined,
      data: Partial<{
        title: string;
        description: string;
        price: number;
        images?: ImageInput[];
        status?: ProductStatus;
        variants?: ProductVariantInput[];
        options?: VariantOptionInput[];
      }>,
    ): Promise<ProductWithRelations> {
      const product = await db.prisma.$transaction(async (tx) => {
        if (!version || version < 1) {
          throw new VersionRequiredError();
        }

        const { images, variants, options, ...productData } = data;

        const result = await tx.product.updateMany({
          where: {
            id,
            organizationId: ctx.organizationId,
            version,
            deletedAt: null,
          },
          data: {
            ...productData,
            updatedById: ctx.userId,
            version: { increment: 1 },
          },
        });

        if (result.count === 0) {
          throw new ConcurrencyConflictError();
        }

        if (images !== undefined) {
          await syncProductImages(tx, id, images);
        }

        if (variants !== undefined) {
          await syncVariants(tx, id, variants);
        }

        if (options !== undefined) {
          await syncOptions(tx, id, options, variants ?? []);
        }

        const updatedProduct = await tx.product.findFirst({
          where: {
            id,
            organizationId: ctx.organizationId,
            deletedAt: null,
            version: version + 1,
          },
          include: {
            images: true,
            // variants: true,
            variants: {
              include: {
                optionValues: true,
              },
            },
            options: { include: { values: true } },
          },
        });

        if (!updatedProduct) {
          throw new NotFoundError(`Product ${id} not found after update`);
        }

        await tx.productHistory.create({
          data: {
            productId: updatedProduct.id,
            version: updatedProduct.version,
            title: updatedProduct.title,
            description: updatedProduct.description,
            price: updatedProduct.price,
            status: updatedProduct.status,
            updatedById: ctx.userId,
          },
        });

        await emitProductEvent(tx, "product.updated");

        return updatedProduct;
      });

      revalidateProductCache(ctx.organizationId, id);

      return product;
    },

    async delete(id: string): Promise<void> {
      const product = await db.prisma.product.findFirst({
        where: {
          id,
          organizationId: ctx.organizationId,
          deletedAt: null,
        },
        select: {
          id: true,
          images: {
            select: {
              key: true,
            },
          },
        },
      });

      if (!product) {
        throw new NotFoundError(`Product ${id} not found`);
      }

      await db.prisma.$transaction(async (tx) => {
        await tx.product.updateMany({
          where: {
            id,
            organizationId: ctx.organizationId,
            deletedAt: null,
          },
          data: {
            deletedAt: new Date(),
            updatedById: ctx.userId,
          },
        });

        if (product.images.length > 0) {
          await tx.productImage.deleteMany({
            where: {
              productId: id,
            },
          });
        }
      });

      await emitProductEvent(db.prisma, "product.deleted");

      if (product.images.length > 0) {
        await Promise.all(
          product.images.map((img) => deleteS3Object(img.key).catch(() => {})),
        );
      }

      revalidateProductCache(ctx.organizationId, id);
    },

    async rollbackToVersion(
      productId: string,
      targetVersion: number,
    ): Promise<ProductWithRelations> {
      const history = await db.prisma.productHistory.findFirst({
        where: {
          productId,
          version: targetVersion,
          product: {
            organizationId: ctx.organizationId,
            deletedAt: null,
          },
        },
      });

      if (!history) {
        throw new NotFoundError(`Version ${targetVersion} not found`);
      }

      const currentProduct = await db.prisma.product.findFirst({
        where: {
          id: productId,
          organizationId: ctx.organizationId,
          deletedAt: null,
        },
        select: {
          version: true,
        },
      });

      if (!currentProduct) {
        throw new NotFoundError("Product not found");
      }

      return this.update(productId, currentProduct.version, {
        title: history.title,
        description: history.description,
        price: Number(history.price),
        status: history.status,
      });
    },

    async bulkUpdateStatus(
      productIds: string[],
      status: ProductStatus,
    ): Promise<Product[]> {
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

        const results: Product[] = [];

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

    async bulkDelete(productIds: string[]): Promise<void> {
      if (!productIds.length) return;

      const products = await db.prisma.product.findMany({
        where: {
          id: { in: productIds },
          organizationId: ctx.organizationId,
          deletedAt: null,
        },
        select: {
          id: true,
          images: {
            select: {
              key: true,
            },
          },
        },
      });

      if (products.length === 0) {
        throw new NotFoundError("No products found for bulk delete");
      }

      const validProductIds = products.map((product) => product.id);
      const imageKeys = products.flatMap((product) =>
        product.images.map((img) => img.key),
      );

      await db.prisma.$transaction(async (tx) => {
        await tx.product.updateMany({
          where: {
            id: { in: validProductIds },
            organizationId: ctx.organizationId,
            deletedAt: null,
          },
          data: {
            deletedAt: new Date(),
            updatedById: ctx.userId,
          },
        });

        if (validProductIds.length > 0) {
          await tx.productImage.deleteMany({
            where: {
              productId: {
                in: validProductIds,
              },
            },
          });
        }
      });

      await emitProductEvent(db.prisma, "product.deleted");

      if (imageKeys.length > 0) {
        await Promise.all(
          imageKeys.map((key) => deleteS3Object(key).catch(() => {})),
        );
      }

      for (const id of validProductIds) {
        revalidateProductCache(ctx.organizationId, id);
      }
    },
  };
}

export type ProductRepo = {
  // READ
  getById(id: string): Promise<ProductWithRelations | null>;

  getAll(params?: {
    take?: number;
    cursor?: string;
    status?: ProductStatus;
    minPrice?: number;
    maxPrice?: number;
    createdBy?: string;
    updatedBy?: string;
    search?: string;
    sortBy?: "createdAt" | "price" | "title" | "status";
    sortOrder?: "asc" | "desc";
  }): Promise<{
    products: ProductListItem[];
    nextCursor?: string;
  }>;

  getHistory(productId: string): Promise<ProductHistory[]>;
  previewVersion(productId: string, version: number): Promise<ProductHistory>;

  // WRITE
  create(data: {
    title: string;
    description: string;
    price: number;
    images?: ImageInput[];
    variants?: ProductVariantInput[];
    options?: VariantOptionInput[];
  }): Promise<ProductWithRelations>;

  update(
    id: string,
    version: number | undefined,
    data: Partial<{
      title: string;
      description: string;
      price: number;
      images?: ImageInput[];
      status?: ProductStatus;
      variants?: ProductVariantInput[];
      options?: VariantOptionInput[];
    }>,
  ): Promise<ProductWithRelations>;

  delete(id: string): Promise<void>;
  rollbackToVersion(
    productId: string,
    targetVersion: number,
  ): Promise<ProductWithRelations>;
  bulkUpdateStatus(
    productIds: string[],
    status: ProductStatus,
  ): Promise<Product[]>;
  bulkDelete(productIds: string[]): Promise<void>;
};
