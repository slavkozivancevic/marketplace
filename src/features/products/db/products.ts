import { randomUUID } from "crypto";
import { tenantPrisma } from "@/core/db/tenantPrisma";
import { revalidateProductCache, revalidateProductHistoryCache } from "./cache";
import type { BulkFilter, BulkUpdateFields } from "../types/bulk";
import {
  MediaInput,
  ProductListItem,
  ProductTranslationsInput,
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
import { copyProductImage, toThumbKey } from "@/services/s3Copy";
import { commitProductMedia } from "@/services/s3Tagging";
import { env } from "@/env/server";
import { NON_DEFAULT_LOCALES } from "@/i18n/config";

async function syncProductMedia(
  tx: Prisma.TransactionClient,
  productId: string,
  media: MediaInput[],
): Promise<Map<string, string>> {
  const existing = await tx.productMedia.findMany({
    where: { productId },
    orderBy: { order: "asc" },
  });

  const existingMap = new Map<string, (typeof existing)[number]>(
    existing.map((m) => [m.key, m]),
  );

  const incomingKeys = new Set(media.map((m) => m.key));

  const toDelete = existing.filter((m) => !incomingKeys.has(m.key));
  if (toDelete.length > 0) {
    await tx.productMedia.deleteMany({
      where: {
        productId,
        key: { in: toDelete.map((m) => m.key) },
      },
    });

    await Promise.all(
      toDelete.flatMap((m) => {
        const thumbKey = m.thumbKey ?? toThumbKey(m.key);
        return [
          deleteS3Object(m.key).catch(() => {}),
          deleteS3Object(thumbKey).catch(() => {}),
        ];
      }),
    );
  }

  const toInsert = media.filter((m) => !existingMap.has(m.key));

  if (toInsert.length > 0) {
    await tx.productMedia.createMany({
      data: toInsert.map((m, index) => ({
        productId,
        key: m.key,
        url: `${env.S3_PUBLIC_URL}/${m.key}`,
        mediaType: m.mediaType,
        thumbKey: m.thumbKey ?? toThumbKey(m.key),
        thumbUrl: `${env.S3_PUBLIC_URL}/${m.thumbKey ?? toThumbKey(m.key)}`,
        mimeType: m.mimeType ?? null,
        durationMs: m.durationMs ?? null,
        width: m.width ?? null,
        height: m.height ?? null,
        order: index,
      })),
    });

    // Newly uploaded media (original + poster/thumb) carries a
    // `lifecycle=pending` tag - strip it so the bucket lifecycle rule no
    // longer marks the objects for deletion. Best-effort: if S3 is briefly
    // unavailable the next save (or the rule's 24h grace) resolves it.
    await Promise.all(
      toInsert.map((m) =>
        commitProductMedia(m.key, m.thumbKey ?? null).catch(() => {}),
      ),
    );
  }

  const reorderOperations = media
    .map((m, index) => {
      const existingMedia = existingMap.get(m.key);

      if (!existingMedia || existingMedia.order === index) {
        return null;
      }

      return tx.productMedia.updateMany({
        where: { productId, key: m.key },
        data: { order: index },
      });
    })
    .filter(
      (op): op is ReturnType<typeof tx.productMedia.updateMany> => op !== null,
    );

  if (reorderOperations.length > 0) {
    await Promise.all(reorderOperations);
  }

  const allMedia = await tx.productMedia.findMany({
    where: { productId },
    select: { id: true, key: true },
  });

  return new Map(allMedia.map((m) => [m.key, m.id]));
}

/**
 * Builds a stable, unique key for a variant from its option values.
 * This is the *semantic* identity of a variant - independent of the
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
  mediaIdByKey: Map<string, string>,
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

    await tx.productVariantMedia.deleteMany({
      where: { variantId: variant.id },
    });

    const incomingKeys = variant.mediaKeys ?? [];
    const rows: { variantId: string; mediaId: string; order: number }[] = [];
    const seenMediaIds = new Set<string>();
    for (const [mIndex, key] of incomingKeys.entries()) {
      const mediaId = mediaIdByKey.get(key);
      if (!mediaId || seenMediaIds.has(mediaId)) continue;
      seenMediaIds.add(mediaId);
      rows.push({ variantId: variant.id, mediaId, order: mIndex });
    }
    if (rows.length > 0) {
      await tx.productVariantMedia.createMany({ data: rows });
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
    const translations = (option.translations ?? null) as Prisma.InputJsonValue | null;

    if (optionId) {
      await tx.variantOption.update({
        where: { id: optionId },
        data: {
          order: optionIndex,
          translations: translations === null ? Prisma.JsonNull : translations,
        },
      });
    } else {
      const createdOption = await tx.variantOption.create({
        data: {
          productId,
          name: option.name,
          order: optionIndex,
          translations: translations === null ? Prisma.JsonNull : translations,
        },
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

/**
 * Reads a single translated string from a `translations` JSON column.
 * Generic over the `field` so it works for `name` (Brand/Category) and
 * `title`/`shortDescription` (Product). Skips the default locale (which
 * lives in the canonical column).
 */
function translatedString(
  translations: unknown,
  locale: string,
  field: string,
): string {
  if (!translations || typeof translations !== "object") return "";
  const localeData = (translations as Record<string, unknown>)[locale];
  if (!localeData || typeof localeData !== "object") return "";
  const value = (localeData as Record<string, unknown>)[field];
  return typeof value === "string" ? value.trim() : "";
}

export async function refreshProductSearchText(
  tx: Prisma.TransactionClient,
  productId: string,
): Promise<void> {
  const p = await tx.product.findFirst({
    where: { id: productId },
    select: {
      title: true,
      shortDescription: true,
      translations: true,
      brand: { select: { name: true, translations: true } },
      categories: {
        select: { category: { select: { name: true, translations: true } } },
      },
    },
  });
  if (!p) return;

  const parts: string[] = [
    p.title,
    p.shortDescription ?? "",
    p.brand?.name ?? "",
    ...p.categories.map((c) => c.category.name),
  ];

  // Index every non-default locale so search hits work regardless of which
  // language the buyer typed.
  for (const loc of NON_DEFAULT_LOCALES) {
    parts.push(translatedString(p.translations, loc, "title"));
    parts.push(translatedString(p.translations, loc, "shortDescription"));
    parts.push(translatedString(p.brand?.translations, loc, "name"));
    for (const c of p.categories) {
      parts.push(translatedString(c.category.translations, loc, "name"));
    }
  }

  const searchText = parts.filter((s) => s.trim().length > 0).join(" ");

  await tx.product.update({
    where: { id: productId },
    data: { searchText },
  });
}

/**
 * Builds the Prisma `where` clause for filter-based bulk operations.
 * Always scoped to the org and non-deleted products. All filter facets
 * combine with AND so callers can compose narrow selections.
 *
 * Stock filtering is a two-source check: simple products carry stock on
 * `Product.stock`, while variant products carry it on each variant. The
 * filter matches if EITHER source satisfies the bound, so users get the
 * intuitive "show me products that can be sold" semantic regardless of
 * whether the catalogue uses variants or not.
 */
function buildBulkFilterWhere(
  organizationId: string,
  filter: BulkFilter,
): Prisma.ProductWhereInput {
  const where: Prisma.ProductWhereInput = {
    organizationId,
    deletedAt: null,
  };

  if (filter.noBrand) {
    where.brandId = null;
  } else if (filter.brandId?.length) {
    where.brandId = { in: filter.brandId };
  }

  if (filter.noCategory) {
    where.categories = { none: {} };
  } else if (filter.categoryId?.length) {
    where.categories = { some: { categoryId: { in: filter.categoryId } } };
  }

  if (filter.status?.length) {
    where.status = { in: filter.status as ProductStatus[] };
  }

  if (filter.minPrice != null || filter.maxPrice != null) {
    where.price = {};
    if (filter.minPrice != null) where.price.gte = filter.minPrice;
    if (filter.maxPrice != null) where.price.lte = filter.maxPrice;
  }

  // Stock semantics:
  //   - "simple" product: stock lives on Product.stock.
  //   - "variant" product: stock lives on each ProductVariant.stock.
  // For min/max we match if EITHER source satisfies the bound. For
  // out-of-stock we require the product to be globally empty:
  // simple stock = 0, OR every variant is 0 (and at least one variant exists,
  // because Prisma's `every` returns true for empty sets).
  if (filter.outOfStock) {
    where.AND = [
      ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
      {
        OR: [
          { variants: { none: {} }, stock: 0 },
          {
            AND: [
              { variants: { some: {} } },
              { variants: { every: { stock: 0 } } },
            ],
          },
        ],
      },
    ];
  } else if (filter.minStock != null || filter.maxStock != null) {
    const stockBound: Prisma.IntFilter = {};
    if (filter.minStock != null) stockBound.gte = filter.minStock;
    if (filter.maxStock != null) stockBound.lte = filter.maxStock;
    where.AND = [
      ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
      {
        OR: [
          { variants: { none: {} }, stock: stockBound },
          { variants: { some: { stock: stockBound } } },
        ],
      },
    ];
  }

  if (filter.taxable !== undefined) where.taxable = filter.taxable;
  if (filter.requiresShipping !== undefined) where.requiresShipping = filter.requiresShipping;
  if (filter.isDigital !== undefined) where.isDigital = filter.isDigital;

  if (filter.titleContains) {
    where.title = { contains: filter.titleContains, mode: "insensitive" };
  }

  return where;
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
          media: { orderBy: { order: "asc" } },
          brand: { select: { id: true, name: true, logoUrl: true } },
          variants: {
            orderBy: { order: "asc" },
            include: {
              optionValues: {
                orderBy: [{ option: { order: "asc" } }, { order: "asc" }],
              },
              media: {
                orderBy: { order: "asc" },
                include: { media: true },
              },
            },
          },
          options: {
            orderBy: { order: "asc" },
            include: { values: { orderBy: { order: "asc" } } },
          },
          categories: {
            include: {
              category: { select: { id: true, name: true, translations: true, parentId: true } },
            },
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
          { searchText: { contains: params.search, mode: "insensitive" } },
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
          media: {
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
      translations?: ProductTranslationsInput | null;
      brandId?: string;
      categoryIds?: string[];
      media?: MediaInput[];
      variants?: ProductVariantInput[];
      options?: VariantOptionInput[];
      /** Defaults to DRAFT; only the bulk-import path passes a non-default value. */
      status?: ProductStatus;
    }): Promise<ProductWithRelations> {
      const { slugify } = await import("@/lib/utils");
      const product = await db.prisma.$transaction(async (tx) => {
        const slug = data.slug?.trim() || slugify(data.title) + "-" + Date.now().toString(36);
        const translations = (data.translations ?? null) as Prisma.InputJsonValue | null;
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
            translations: translations === null ? Prisma.JsonNull : translations,
            brandId: data.brandId,
            status: data.status ?? "DRAFT",
            ...(data.status === "PUBLISHED" && { publishedAt: new Date() }),
            organizationId: ctx.organizationId,
            createdById: ctx.userId,
          },
        });

        const mediaIdByKey = data?.media?.length
          ? await syncProductMedia(tx, created.id, data.media)
          : new Map<string, string>();

        if (data?.variants?.length) {
          await syncVariants(tx, created.id, data.variants, mediaIdByKey);
        }

        if (data?.options?.length) {
          await syncOptions(tx, created.id, data.options, data.variants ?? []);
        }

        if (data?.categoryIds?.length) {
          await tx.productCategory.createMany({
            data: data.categoryIds.map((categoryId) => ({ productId: created.id, categoryId })),
            skipDuplicates: true,
          });
        }

        await refreshProductSearchText(tx, created.id);

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
            media: { orderBy: { order: "asc" } },
            brand: { select: { id: true, name: true, logoUrl: true } },
            variants: {
              orderBy: { order: "asc" },
              include: {
                optionValues: {
                  orderBy: [{ option: { order: "asc" } }, { order: "asc" }],
                },
                media: {
                  orderBy: { order: "asc" },
                  include: { media: true },
                },
              },
            },
            options: {
              orderBy: { order: "asc" },
              include: { values: { orderBy: { order: "asc" } } },
            },
            categories: {
              include: {
                category: { select: { id: true, name: true, translations: true, parentId: true } },
              },
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
        translations?: ProductTranslationsInput | null;
        brandId?: string;
        categoryIds?: string[];
        media?: MediaInput[];
        status?: ProductStatus;
        variants?: ProductVariantInput[];
        options?: VariantOptionInput[];
      }>,
    ): Promise<ProductWithRelations> {
      const product = await db.prisma.$transaction(async (tx) => {
        if (!version || version < 1) {
          throw new VersionRequiredError();
        }

        const { media, variants, options, weightUnit, dimensionUnit, categoryIds, translations, ...productData } = data;

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
            ...(translations !== undefined && {
              translations:
                translations === null
                  ? Prisma.JsonNull
                  : (translations as Prisma.InputJsonValue),
            }),
            updatedById: ctx.userId,
            version: { increment: 1 },
          },
        });

        if (result.count === 0) {
          throw new ConcurrencyConflictError();
        }

        let mediaIdByKey: Map<string, string>;
        if (media !== undefined) {
          mediaIdByKey = await syncProductMedia(tx, id, media);
        } else {
          const existingMedia = await tx.productMedia.findMany({
            where: { productId: id },
            select: { id: true, key: true },
          });
          mediaIdByKey = new Map(
            existingMedia.map((m) => [m.key, m.id]),
          );
        }

        if (variants !== undefined) {
          await syncVariants(tx, id, variants, mediaIdByKey);
        }

        if (options !== undefined) {
          await syncOptions(tx, id, options, variants ?? []);
        }

        if (categoryIds !== undefined) {
          await tx.productCategory.deleteMany({ where: { productId: id } });
          if (categoryIds.length > 0) {
            await tx.productCategory.createMany({
              data: categoryIds.map((categoryId) => ({ productId: id, categoryId })),
              skipDuplicates: true,
            });
          }
        }

        await refreshProductSearchText(tx, id);

        const updatedProduct = await tx.product.findFirst({
          where: {
            id,
            organizationId: ctx.organizationId,
            deletedAt: null,
            version: version + 1,
          },
          include: {
            media: { orderBy: { order: "asc" } },
            brand: { select: { id: true, name: true, logoUrl: true } },
            variants: {
              orderBy: { order: "asc" },
              include: {
                optionValues: {
                  orderBy: [{ option: { order: "asc" } }, { order: "asc" }],
                },
                media: {
                  orderBy: { order: "asc" },
                  include: { media: true },
                },
              },
            },
            options: {
              orderBy: { order: "asc" },
              include: { values: { orderBy: { order: "asc" } } },
            },
            categories: {
              include: {
                category: { select: { id: true, name: true, translations: true, parentId: true } },
              },
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
          media: {
            select: {
              key: true,
              thumbKey: true,
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

        if (product.media.length > 0) {
          await tx.productMedia.deleteMany({
            where: {
              productId: id,
            },
          });
        }
      });

      await emitProductEvent(db.prisma, "product.deleted");

      if (product.media.length > 0) {
        await Promise.all(
          product.media.flatMap((m) => [
            deleteS3Object(m.key).catch(() => {}),
            deleteS3Object(m.thumbKey ?? toThumbKey(m.key)).catch(() => {}),
          ]),
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
        price: history.price,
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

    async duplicate(id: string): Promise<ProductWithRelations> {
      // 1. Fetch the source product with all relations needed for duplication.
      const source = await db.prisma.product.findFirst({
        where: { id, organizationId: ctx.organizationId, deletedAt: null },
        include: {
          media: { orderBy: { order: "asc" } },
          variants: {
            orderBy: { order: "asc" },
            include: {
              optionValues: {
                include: { option: { select: { name: true } } },
              },
              media: {
                orderBy: { order: "asc" },
                include: { media: { select: { key: true } } },
              },
            },
          },
          options: {
            orderBy: { order: "asc" },
            include: { values: { orderBy: { order: "asc" } } },
          },
        },
      });

      if (!source) {
        throw new NotFoundError(`Product ${id} not found`);
      }

      // 2. Copy S3 media server-side (pure S3 CopyObject - no re-upload).
      //    Build oldKey → newKey mapping so variant media references can be updated.
      //    copyProductImage handles thumb/poster copy as well - works for both
      //    image and video media (they share the /products/thumbs/ thumb path).
      const keyMap = new Map<string, string>();
      const copiedKeys: string[] = [];

      try {
        await Promise.all(
          source.media.map(async (m) => {
            // Replace the final UUID segment with a fresh one.
            const newKey = m.key.replace(/[^/]+$/, randomUUID());
            await copyProductImage(m.key, newKey);
            keyMap.set(m.key, newKey);
            copiedKeys.push(newKey);
          }),
        );
      } catch (err) {
        // Roll back any S3 copies that succeeded before the failure.
        await Promise.all(copiedKeys.map((k) => deleteS3Object(k).catch(() => {})));
        throw err;
      }

      // 3. Convert DB relations into the create() input format.
      const suffix = Date.now().toString(36);

      const media: MediaInput[] = source.media.map((m) => ({
        key: keyMap.get(m.key)!,
        mediaType: m.mediaType,
        mimeType: m.mimeType,
        durationMs: m.durationMs,
        width: m.width,
        height: m.height,
      }));

      const options = source.options.map((opt) => ({
        name: opt.name,
        values: opt.values.map((v) => v.value),
        translations: opt.translations as VariantOptionInput["translations"] ?? null,
      }));

      const variants: ProductVariantInput[] = source.variants.map((v) => ({
        sku: `${v.sku}-copy-${suffix}`,
        price: v.price,
        compareAtPrice: v.compareAtPrice ?? undefined,
        costPrice: v.costPrice ?? undefined,
        stock: v.stock,
        barcode: v.barcode ?? undefined,
        weight: v.weight ?? undefined,
        weightUnit: v.weightUnit ?? undefined,
        mediaKeys: v.media
          .map((vm) => keyMap.get(vm.media.key))
          .filter((k): k is string => k !== undefined),
        options: v.optionValues.map((ov) => ({
          name: ov.option.name,
          value: ov.value,
        })),
      }));

      // 4. Create the duplicate.  On DB failure, clean up the copied S3 objects.
      try {
        return await this.create({
          title: `Copy of ${source.title}`,
          description: source.description,
          shortDescription: source.shortDescription ?? undefined,
          price: source.price,
          compareAtPrice: source.compareAtPrice ?? undefined,
          costPrice: source.costPrice ?? undefined,
          stock: source.stock ?? undefined,
          barcode: source.barcode ?? undefined,
          taxable: source.taxable,
          taxCode: source.taxCode ?? undefined,
          requiresShipping: source.requiresShipping,
          isDigital: source.isDigital,
          weight: source.weight ?? undefined,
          weightUnit: source.weightUnit ?? undefined,
          length: source.length ?? undefined,
          width: source.width ?? undefined,
          height: source.height ?? undefined,
          dimensionUnit: source.dimensionUnit ?? undefined,
          metaTitle: source.metaTitle ?? undefined,
          metaDescription: source.metaDescription ?? undefined,
          translations: (source.translations as ProductTranslationsInput | null) ?? null,
          brandId: source.brandId ?? undefined,
          media: media.length > 0 ? media : undefined,
          variants: variants.length > 0 ? variants : undefined,
          options: options.length > 0 ? options : undefined,
        });
      } catch (err) {
        await Promise.all(copiedKeys.map((k) => deleteS3Object(k).catch(() => {})));
        throw err;
      }
    },

    // -----------------------------------------------------------------------
    // Filter-based bulk operations
    // -----------------------------------------------------------------------

    async previewByFilter(
      filter: BulkFilter,
    ): Promise<{
      count: number;
      samples: {
        id: string;
        title: string;
        price: number;
        status: ProductStatus;
        brand: { name: string } | null;
      }[];
    }> {
      const where = buildBulkFilterWhere(ctx.organizationId, filter);

      const [count, samples] = await Promise.all([
        db.prisma.product.count({ where }),
        db.prisma.product.findMany({
          where,
          take: 5,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            title: true,
            price: true,
            status: true,
            brand: { select: { name: true } },
          },
        }),
      ]);

      return {
        count,
        samples: samples.map((p) => ({
          ...p,
          price: p.price,
        })),
      };
    },

    async bulkDeleteByFilter(filter: BulkFilter): Promise<{ count: number }> {
      const where = buildBulkFilterWhere(ctx.organizationId, filter);

      const products = await db.prisma.product.findMany({
        where,
        select: {
          id: true,
          media: { select: { key: true, thumbKey: true } },
        },
      });

      if (products.length === 0) return { count: 0 };

      const ids = products.map((p) => p.id);
      const mediaKeys = products.flatMap((p) =>
        p.media.flatMap((m) => [m.key, m.thumbKey ?? toThumbKey(m.key)]),
      );

      await db.prisma.$transaction(async (tx) => {
        await tx.product.updateMany({
          where: { id: { in: ids }, organizationId: ctx.organizationId, deletedAt: null },
          data: { deletedAt: new Date(), updatedById: ctx.userId },
        });
        if (ids.length > 0) {
          await tx.productMedia.deleteMany({ where: { productId: { in: ids } } });
        }
      });

      await emitProductEvent(db.prisma, "product.deleted");

      if (mediaKeys.length > 0) {
        await Promise.all(mediaKeys.map((key) => deleteS3Object(key).catch(() => {})));
      }

      for (const id of ids) {
        revalidateProductCache(ctx.organizationId, id);
      }

      return { count: ids.length };
    },

    async bulkUpdateByFilter(
      filter: BulkFilter,
      updates: BulkUpdateFields,
    ): Promise<{ count: number; skippedWithVariants: number }> {
      const where = buildBulkFilterWhere(ctx.organizationId, filter);

      const products = await db.prisma.product.findMany({
        where,
        select: {
          id: true,
          version: true,
          title: true,
          description: true,
          price: true,
          status: true,
          _count: { select: { variants: true } },
        },
      });

      if (products.length === 0) return { count: 0, skippedWithVariants: 0 };

      const {
        status,
        brandId,
        price,
        compareAtPrice,
        costPrice,
        taxable,
        requiresShipping,
        isDigital,
        stock,
        categories,
      } = updates;

      // `Product.stock` is the canonical inventory for simple products only;
      // products with variants carry stock on each ProductVariant row. Silently
      // writing to Product.stock for variant products would be misleading - the
      // value isn't read by checkout/PDP. So we partition the matched set and
      // report how many were skipped so the caller can surface that to users.
      const stockUpdateRequested = stock !== undefined;
      const stockEligible = stockUpdateRequested
        ? products.filter((p) => p._count.variants === 0)
        : products;
      const skippedWithVariants = stockUpdateRequested
        ? products.length - stockEligible.length
        : 0;

      // Other updates (status, brand, categories, etc.) apply to all matched
      // products regardless of variant configuration.
      const baseIds = products.map((p) => p.id);
      const stockIds = stockEligible.map((p) => p.id);

      // UncheckedUpdateManyInput allows FK scalars (brandId, updatedById) directly.
      const scalarUpdates: Prisma.ProductUncheckedUpdateManyInput = {
        updatedById: ctx.userId,
        version: { increment: 1 },
      };

      if (status !== undefined) scalarUpdates.status = status as ProductStatus;
      if (brandId !== undefined) scalarUpdates.brandId = brandId;
      if (price !== undefined) scalarUpdates.price = price;
      if (compareAtPrice !== undefined) scalarUpdates.compareAtPrice = compareAtPrice;
      if (costPrice !== undefined) scalarUpdates.costPrice = costPrice;
      if (taxable !== undefined) scalarUpdates.taxable = taxable;
      if (requiresShipping !== undefined) scalarUpdates.requiresShipping = requiresShipping;
      if (isDigital !== undefined) scalarUpdates.isDigital = isDigital;

      // If stock is the ONLY change and every matched product has variants,
      // there is nothing to write - bail out cleanly so we don't bump versions
      // for no reason.
      const onlyStockChange =
        stockUpdateRequested &&
        status === undefined &&
        brandId === undefined &&
        price === undefined &&
        compareAtPrice === undefined &&
        costPrice === undefined &&
        taxable === undefined &&
        requiresShipping === undefined &&
        isDigital === undefined &&
        categories === undefined;
      if (onlyStockChange && stockIds.length === 0) {
        return { count: 0, skippedWithVariants };
      }

      const productIds = baseIds;

      // Categories contribute to the denormalized searchText blob, so any
      // category mutation requires re-running refreshProductSearchText for
      // every affected product. We also want this in the same transaction
      // as the category writes so a partial failure doesn't leave the
      // search index out of sync.
      const categoryMutationRequested =
        categories !== undefined && categories.mode !== undefined;

      // Brand-name change can also drift searchText, but brand-set affects
      // exactly one canonical row so we don't loop products for it here.

      await db.prisma.$transaction(async (tx) => {
        // Non-stock scalar updates apply to every matched product. Skip the
        // round-trip entirely when there's nothing to write (e.g. stock-only
        // request where every match has variants - see early return above).
        const hasNonStockScalarUpdate =
          status !== undefined ||
          brandId !== undefined ||
          price !== undefined ||
          compareAtPrice !== undefined ||
          costPrice !== undefined ||
          taxable !== undefined ||
          requiresShipping !== undefined ||
          isDigital !== undefined;

        if (hasNonStockScalarUpdate || categoryMutationRequested) {
          await tx.product.updateMany({
            where: {
              id: { in: productIds },
              organizationId: ctx.organizationId,
              deletedAt: null,
            },
            data: scalarUpdates,
          });
        }

        // Stock writes are partitioned: only products without variants get
        // Product.stock updated. The version bump rides along with this write.
        if (stockUpdateRequested && stockIds.length > 0) {
          await tx.product.updateMany({
            where: {
              id: { in: stockIds },
              organizationId: ctx.organizationId,
              deletedAt: null,
            },
            data: {
              stock,
              updatedById: ctx.userId,
              // Only bump version here when we didn't already bump it above.
              ...(hasNonStockScalarUpdate || categoryMutationRequested
                ? {}
                : { version: { increment: 1 } }),
            },
          });
        }

        if (categoryMutationRequested && categories) {
          if (categories.mode === "set") {
            await tx.productCategory.deleteMany({
              where: { productId: { in: productIds } },
            });
            if (categories.ids.length > 0) {
              await tx.productCategory.createMany({
                data: productIds.flatMap((productId) =>
                  categories.ids.map((categoryId) => ({ productId, categoryId })),
                ),
                skipDuplicates: true,
              });
            }
          } else if (categories.mode === "add" && categories.ids.length > 0) {
            await tx.productCategory.createMany({
              data: productIds.flatMap((productId) =>
                categories.ids.map((categoryId) => ({ productId, categoryId })),
              ),
              skipDuplicates: true,
            });
          } else if (categories.mode === "remove" && categories.ids.length > 0) {
            await tx.productCategory.deleteMany({
              where: {
                productId: { in: productIds },
                categoryId: { in: categories.ids },
              },
            });
          }

          // Refresh searchText for every affected product. Sequential to
          // avoid hammering the txn connection with N concurrent updates.
          for (const id of productIds) {
            await refreshProductSearchText(tx, id);
          }
        }

        // Write a history entry per product when status or price changes.
        if (status !== undefined || price !== undefined) {
          for (const p of products) {
            await tx.productHistory.create({
              data: {
                productId: p.id,
                version: p.version + 1,
                title: p.title,
                description: p.description,
                price: price !== undefined ? price : p.price,
                status: (status !== undefined ? status : p.status) as ProductStatus,
                updatedById: ctx.userId,
              },
            });
          }
          await emitProductEvent(tx, "product.status.changed");
        } else {
          await emitProductEvent(tx, "product.updated");
        }
      });

      for (const p of products) {
        revalidateProductCache(ctx.organizationId, p.id);
      }

      // For a stock-only request, only stock-eligible (variantless) products
      // were actually written - report that as the canonical count so the UI
      // doesn't claim it updated rows that have variants.
      const writtenCount = onlyStockChange ? stockIds.length : products.length;
      return { count: writtenCount, skippedWithVariants };
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
          media: {
            select: {
              key: true,
              thumbKey: true,
            },
          },
        },
      });

      if (products.length === 0) {
        throw new NotFoundError("No products found for bulk delete");
      }

      const validProductIds = products.map((product) => product.id);
      const mediaKeys = products.flatMap((product) =>
        product.media.flatMap((m) => [m.key, m.thumbKey ?? toThumbKey(m.key)]),
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
          await tx.productMedia.deleteMany({
            where: {
              productId: {
                in: validProductIds,
              },
            },
          });
        }
      });

      await emitProductEvent(db.prisma, "product.deleted");

      if (mediaKeys.length > 0) {
        await Promise.all(
          mediaKeys.map((key) => deleteS3Object(key).catch(() => {})),
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
    translations?: ProductTranslationsInput | null;
    brandId?: string;
    categoryIds?: string[];
    media?: MediaInput[];
    variants?: ProductVariantInput[];
    options?: VariantOptionInput[];
    status?: ProductStatus;
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
      translations?: ProductTranslationsInput | null;
      brandId?: string;
      media?: MediaInput[];
      status?: ProductStatus;
      variants?: ProductVariantInput[];
      options?: VariantOptionInput[];
    }>,
  ): Promise<ProductWithRelations>;

  delete(id: string): Promise<void>;
  duplicate(id: string): Promise<ProductWithRelations>;
  rollbackToVersion(
    productId: string,
    targetVersion: number,
  ): Promise<ProductWithRelations>;
  bulkUpdateStatus(
    productIds: string[],
    status: ProductStatus,
  ): Promise<Product[]>;
  bulkDelete(productIds: string[]): Promise<void>;
  previewByFilter(filter: BulkFilter): Promise<{
    count: number;
    samples: {
      id: string;
      title: string;
      price: number;
      status: ProductStatus;
      brand: { name: string } | null;
    }[];
  }>;
  bulkDeleteByFilter(filter: BulkFilter): Promise<{ count: number }>;
  bulkUpdateByFilter(
    filter: BulkFilter,
    updates: BulkUpdateFields,
  ): Promise<{ count: number; skippedWithVariants: number }>;
};
