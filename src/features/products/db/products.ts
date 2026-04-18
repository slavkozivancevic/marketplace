import { tenantPrisma } from "@/core/db/tenantPrisma";
import { revalidateProductCache, revalidateProductHistoryCache } from "./cache";
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

async function syncProductImages(
  tx: Prisma.TransactionClient,
  productId: string,
  images: ImageInput[],
): Promise<Map<string, string>> {
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
        url: `${env.S3_PUBLIC_URL}/${img.key}`,
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

  const allImages = await tx.productImage.findMany({
    where: { productId },
    select: { id: true, key: true },
  });

  return new Map(allImages.map((img) => [img.key, img.id]));
}

/**
 * Builds a stable, unique key for a variant from its option values.
 * This is the *semantic* identity of a variant — independent of the
 * (user-editable) SKU, so two variants like `Color=Black, Size=37` and
 * `Color=Black-brown, Size=37` are always distinguishable even if their
 * SKUs happen to collide.
 *
 * Returns null for variants with no options (manual variants), which
 * fall back to SKU-based identity.
 */
function variantSignature(
  options: { name: string; value: string }[] | undefined,
): string | null {
  if (!options || options.length === 0) return null;
  return [...options]
    .map((o) => `${o.name.trim()}\u0000${o.value.trim()}`)
    .sort()
    .join("\u0001");
}

async function syncVariants(
  tx: Prisma.TransactionClient,
  productId: string,
  variants: ProductVariantInput[],
  imageIdByKey: Map<string, string>,
) {
  const existing = await tx.productVariant.findMany({
    where: { productId },
    include: {
      optionValues: {
        include: { option: { select: { name: true } } },
      },
    },
  });

  const existingBySignature = new Map<string, (typeof existing)[number]>();
  const existingBySku = new Map<string, (typeof existing)[number]>();
  for (const v of existing) {
    const sig = variantSignature(
      v.optionValues.map((ov) => ({
        name: ov.option.name,
        value: ov.value,
      })),
    );
    if (sig !== null) {
      existingBySignature.set(sig, v);
    } else {
      existingBySku.set(v.sku, v);
    }
  }

  const seenSignatures = new Set<string>();
  const seenManualSkus = new Set<string>();
  const resolved: {
    variant: ProductVariantInput;
    existingId: string | null;
  }[] = [];

  for (const variant of variants) {
    const sig = variantSignature(variant.options);
    if (sig !== null) {
      if (seenSignatures.has(sig)) {
        throw new Error(
          `Duplicate variant option combination: ${sig.replace(/\u0000/g, "=").replace(/\u0001/g, ", ")}`,
        );
      }
      seenSignatures.add(sig);
      resolved.push({
        variant,
        existingId: existingBySignature.get(sig)?.id ?? null,
      });
    } else {
      if (seenManualSkus.has(variant.sku)) {
        throw new Error(`Duplicate manual variant SKU: ${variant.sku}`);
      }
      seenManualSkus.add(variant.sku);
      resolved.push({
        variant,
        existingId: existingBySku.get(variant.sku)?.id ?? null,
      });
    }
  }

  const retainedIds = new Set(
    resolved.map((r) => r.existingId).filter((id): id is string => id !== null),
  );
  const toDelete = existing.filter((v) => !retainedIds.has(v.id));
  if (toDelete.length > 0) {
    await tx.productVariant.deleteMany({
      where: { productId, id: { in: toDelete.map((v) => v.id) } },
    });
  }

  for (const { existingId } of resolved) {
    if (existingId) {
      await tx.productVariant.update({
        where: { id: existingId },
        data: { sku: `__sync_${existingId}__` },
      });
    }
  }

  for (const [index, { variant, existingId }] of resolved.entries()) {
    const variantScalars = {
      sku: variant.sku,
      price: variant.price,
      compareAtPrice: variant.compareAtPrice ?? null,
      costPrice: variant.costPrice ?? null,
      stock: variant.stock,
      barcode: variant.barcode,
      weight: variant.weight ?? null,
      weightUnit: (variant.weightUnit as never) ?? null,
      order: index,
    };

    if (existingId) {
      await tx.productVariant.update({
        where: { id: existingId },
        data: { ...variantScalars, updatedAt: new Date() },
      });
      variant.id = existingId;
    } else {
      const created = await tx.productVariant.create({
        data: { productId, ...variantScalars },
      });
      variant.id = created.id;
    }

    await tx.productVariantImage.deleteMany({
      where: { variantId: variant.id },
    });

    const incomingKeys = variant.imageKeys ?? [];
    const rows: { variantId: string; imageId: string; order: number }[] = [];
    const seenImageIds = new Set<string>();
    for (const [imgIndex, key] of incomingKeys.entries()) {
      const imageId = imageIdByKey.get(key);
      if (!imageId || seenImageIds.has(imageId)) continue;
      seenImageIds.add(imageId);
      rows.push({ variantId: variant.id, imageId, order: imgIndex });
    }
    if (rows.length > 0) {
      await tx.productVariantImage.createMany({ data: rows });
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

  for (const [optionIndex, option] of options.entries()) {
    let optionId = existingMap.get(option.name)?.id;

    if (optionId) {
      await tx.variantOption.update({
        where: { id: optionId },
        data: { order: optionIndex },
      });
    } else {
      const createdOption = await tx.variantOption.create({
        data: { productId, name: option.name, order: optionIndex },
      });
      optionId = createdOption.id;
    }

    await tx.variantOptionValue.deleteMany({ where: { optionId } });

    const writtenForVariant = new Set<string>();

    for (const variant of variants) {
      if (!variant.id) continue;
      if (writtenForVariant.has(variant.id)) continue;

      const optionValue = variant.options?.find((o) => o.name === option.name);
      if (!optionValue) continue;

      const valueOrder = option.values.indexOf(optionValue.value);

      await tx.variantOptionValue.create({
        data: {
          optionId,
          value: optionValue.value,
          variantId: variant.id,
          order: valueOrder >= 0 ? valueOrder : 0,
        },
      });
      writtenForVariant.add(variant.id);
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
    async getById(id: string): Promise<ProductWithRelations | null> {
      return db.prisma.product.findFirst({
        where: {
          id,
          organizationId: ctx.organizationId,
          deletedAt: null,
        },
        include: {
          images: { orderBy: { order: "asc" } },
          brand: { select: { id: true, name: true, logoUrl: true } },
          variants: {
            orderBy: { order: "asc" },
            include: {
              optionValues: {
                orderBy: [{ option: { order: "asc" } }, { order: "asc" }],
              },
              images: { orderBy: { order: "asc" } },
            },
          },
          options: {
            orderBy: { order: "asc" },
            include: { values: { orderBy: { order: "asc" } } },
          },
        },
      });
    },

    async getAll(params?: {
      take?: number;
      cursor?: string;
      status?: ProductStatus[];
      minPrice?: number;
      maxPrice?: number;
      createdBy?: string;
      updatedBy?: string;
      search?: string;
      sortBy?: SortField;
      sortOrder?: SortOrder;
      brandId?: string[];
    }): Promise<{
      products: ProductListItem[];
      nextCursor?: string;
    }> {
      const take = params?.take ?? 20;
      const cursor = params?.cursor;

      const where: Prisma.ProductWhereInput = {
        organizationId: ctx.organizationId,
        deletedAt: null,
      };

      if (params?.status?.length) where.status = { in: params.status };

      if (params?.minPrice != null || params?.maxPrice != null) {
        where.price = {};
        if (params.minPrice != null) where.price.gte = params.minPrice;
        if (params.maxPrice != null) where.price.lte = params.maxPrice;
      }

      if (params?.createdBy) where.createdById = params.createdBy;
      if (params?.updatedBy) where.updatedById = params.updatedBy;
      if (params?.brandId?.length) where.brandId = { in: params.brandId };

      if (params?.search) {
        where.OR = [
          { title: { contains: params.search, mode: "insensitive" } },
          { shortDescription: { contains: params.search, mode: "insensitive" } },
          { description: { contains: params.search, mode: "insensitive" } },
          { barcode: { contains: params.search, mode: "insensitive" } },
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
            take: 5,
            orderBy: { order: "asc" },
          },
          brand: { select: { id: true, name: true, logoUrl: true } },
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

    async getHistory(productId: string) {
      return db.prisma.productHistory.findMany({
        where: {
          productId,
          product: {
            organizationId: ctx.organizationId,
            deletedAt: null,
          },
        },
        orderBy: { version: "desc" },
        include: {
          updatedBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });
    },

    async previewVersion(productId: string, version: number) {
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

    async create(data: {
      title: string;
      slug?: string;
      description: string;
      shortDescription?: string;
      price: number;
      compareAtPrice?: number | null;
      costPrice?: number | null;
      stock?: number | null;
      barcode?: string;
      taxable?: boolean;
      taxCode?: string;
      requiresShipping?: boolean;
      isDigital?: boolean;
      weight?: number | null;
      weightUnit?: string | null;
      length?: number | null;
      width?: number | null;
      height?: number | null;
      dimensionUnit?: string | null;
      metaTitle?: string;
      metaDescription?: string;
      brandId?: string;
      images?: ImageInput[];
      variants?: ProductVariantInput[];
      options?: VariantOptionInput[];
    }): Promise<ProductWithRelations> {
      const { slugify } = await import("@/lib/utils");
      const product = await db.prisma.$transaction(async (tx) => {
        const slug = data.slug?.trim() || slugify(data.title) + "-" + Date.now().toString(36);
        const created = await tx.product.create({
          data: {
            title: data.title,
            slug,
            description: data.description,
            shortDescription: data.shortDescription,
            price: data.price,
            compareAtPrice: data.compareAtPrice ?? null,
            costPrice: data.costPrice ?? null,
            stock: data.stock ?? null,
            barcode: data.barcode,
            taxable: data.taxable ?? true,
            taxCode: data.taxCode,
            requiresShipping: data.requiresShipping ?? true,
            isDigital: data.isDigital ?? false,
            weight: data.weight ?? null,
            weightUnit: (data.weightUnit as never) ?? null,
            length: data.length ?? null,
            width: data.width ?? null,
            height: data.height ?? null,
            dimensionUnit: (data.dimensionUnit as never) ?? null,
            metaTitle: data.metaTitle,
            metaDescription: data.metaDescription,
            brandId: data.brandId,
            organizationId: ctx.organizationId,
            createdById: ctx.userId,
          },
        });

        const imageIdByKey = data?.images?.length
          ? await syncProductImages(tx, created.id, data.images)
          : new Map<string, string>();

        if (data?.variants?.length) {
          await syncVariants(tx, created.id, data.variants, imageIdByKey);
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
            images: { orderBy: { order: "asc" } },
            brand: { select: { id: true, name: true, logoUrl: true } },
            variants: {
              orderBy: { order: "asc" },
              include: {
                optionValues: {
                  orderBy: [{ option: { order: "asc" } }, { order: "asc" }],
                },
                images: { orderBy: { order: "asc" } },
              },
            },
            options: {
              orderBy: { order: "asc" },
              include: { values: { orderBy: { order: "asc" } } },
            },
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
        slug?: string;
        description: string;
        shortDescription?: string;
        price: number;
        compareAtPrice?: number | null;
        costPrice?: number | null;
        stock?: number | null;
        barcode?: string;
        taxable?: boolean;
        taxCode?: string;
        requiresShipping?: boolean;
        isDigital?: boolean;
        weight?: number | null;
        weightUnit?: string | null;
        length?: number | null;
        width?: number | null;
        height?: number | null;
        dimensionUnit?: string | null;
        metaTitle?: string;
        metaDescription?: string;
        brandId?: string;
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

        const { images, variants, options, weightUnit, dimensionUnit, ...productData } = data;

        const result = await tx.product.updateMany({
          where: {
            id,
            organizationId: ctx.organizationId,
            version,
            deletedAt: null,
          },
          data: {
            ...productData,
            ...(weightUnit !== undefined && { weightUnit: weightUnit as never }),
            ...(dimensionUnit !== undefined && { dimensionUnit: dimensionUnit as never }),
            updatedById: ctx.userId,
            version: { increment: 1 },
          },
        });

        if (result.count === 0) {
          throw new ConcurrencyConflictError();
        }

        let imageIdByKey: Map<string, string>;
        if (images !== undefined) {
          imageIdByKey = await syncProductImages(tx, id, images);
        } else {
          const existingImages = await tx.productImage.findMany({
            where: { productId: id },
            select: { id: true, key: true },
          });
          imageIdByKey = new Map(
            existingImages.map((img) => [img.key, img.id]),
          );
        }

        if (variants !== undefined) {
          await syncVariants(tx, id, variants, imageIdByKey);
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
            images: { orderBy: { order: "asc" } },
            brand: { select: { id: true, name: true, logoUrl: true } },
            variants: {
              orderBy: { order: "asc" },
              include: {
                optionValues: {
                  orderBy: [{ option: { order: "asc" } }, { order: "asc" }],
                },
                images: { orderBy: { order: "asc" } },
              },
            },
            options: {
              orderBy: { order: "asc" },
              include: { values: { orderBy: { order: "asc" } } },
            },
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

        return updatedProduct as ProductWithRelations;
      });

      revalidateProductCache(ctx.organizationId, id);
      revalidateProductHistoryCache(ctx.organizationId, id);

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
  getById(id: string): Promise<ProductWithRelations | null>;

  getAll(params?: {
    take?: number;
    cursor?: string;
    status?: ProductStatus[];
    minPrice?: number;
    maxPrice?: number;
    createdBy?: string;
    updatedBy?: string;
    search?: string;
    sortBy?: "createdAt" | "price" | "title" | "status";
    sortOrder?: "asc" | "desc";
    brandId?: string[];
  }): Promise<{
    products: ProductListItem[];
    nextCursor?: string;
  }>;

  getHistory(productId: string): Promise<
    (ProductHistory & {
      updatedBy: { id: string; name: string | null; email: string } | null;
    })[]
  >;
  previewVersion(productId: string, version: number): Promise<ProductHistory>;

  create(data: {
    title: string;
    slug?: string;
    description: string;
    shortDescription?: string;
    price: number;
    compareAtPrice?: number | null;
    costPrice?: number | null;
    stock?: number | null;
    barcode?: string;
    taxable?: boolean;
    taxCode?: string;
    requiresShipping?: boolean;
    isDigital?: boolean;
    weight?: number | null;
    weightUnit?: string | null;
    length?: number | null;
    width?: number | null;
    height?: number | null;
    dimensionUnit?: string | null;
    metaTitle?: string;
    metaDescription?: string;
    brandId?: string;
    images?: ImageInput[];
    variants?: ProductVariantInput[];
    options?: VariantOptionInput[];
  }): Promise<ProductWithRelations>;

  update(
    id: string,
    version: number | undefined,
    data: Partial<{
      title: string;
      slug?: string;
      description: string;
      shortDescription?: string;
      price: number;
      compareAtPrice?: number | null;
      costPrice?: number | null;
      stock?: number | null;
      barcode?: string;
      taxable?: boolean;
      taxCode?: string;
      requiresShipping?: boolean;
      isDigital?: boolean;
      weight?: number | null;
      weightUnit?: string | null;
      length?: number | null;
      width?: number | null;
      height?: number | null;
      dimensionUnit?: string | null;
      metaTitle?: string;
      metaDescription?: string;
      brandId?: string;
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
