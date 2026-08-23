import type { TransactionClient } from "@/core/db/prisma";
import { randomUUID } from "crypto";
import { tenantPrisma } from "@/core/db/tenantPrisma";
import { revalidateProductCache, revalidateProductHistoryCache } from "./cache";
import type { BulkFilter, BulkUpdateFields } from "../types/bulk";
import { BULK_CATEGORY_MUTATION_LIMIT } from "../types/bulk";
import {
  AdminProductListItem,
  MediaInput,
  ProductTranslationsInput,
  ProductVariantInput,
  ProductWithRelations,
  RequestContext,
} from "@/types/types";
import {
  Prisma,
  Product,
  ProductStatus,
} from "@/generated/prisma/client";
import {
  BulkLimitExceededError,
  ConcurrencyConflictError,
  NotFoundError,
  VersionRequiredError,
} from "@/features/common/errors/domainErrors";
import { emitProductEvent } from "@/features/webhooks/productEvents";
import { recordSlugChanges } from "@/lib/seo/slugHistory";
import { createWithUniqueSlugRetry } from "@/lib/db/uniqueSlugRetry";
import { deleteS3Object } from "@/services/s3Delete";
import { copyProductImage, toThumbKey, toEmailThumbKey } from "@/services/s3Copy";
import { commitProductMedia } from "@/services/s3Tagging";
import { env } from "@/env/server";
import { slugify } from "@/lib/utils";
import { copyName } from "@/lib/i18n/copyName";
import {
  DEFAULT_LOCALE,
  NON_DEFAULT_LOCALES,
  SUPPORTED_LOCALES,
} from "@/i18n/config";

/**
 * Shape of a single per-locale row about to be written to ProductTranslation.
 * `searchText` is populated by `refreshProductSearchText` after relations are
 * synced; callers building rows here may leave it null.
 */
type ProductTranslationRow = {
  locale: string;
  title: string;
  slug: string;
  description: string;
  shortDescription: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
};

type ProductMutationFields = {
  title: string;
  slug?: string;
  description: string;
  shortDescription?: string;
  metaTitle?: string;
  metaDescription?: string;
  translations?: ProductTranslationsInput | null;
};

/**
 * Builds the per-locale ProductTranslation rows from the form input shape.
 * The default locale's values come from the top-level canonical fields; the
 * non-default locales come from the `translations` map. A non-default locale
 * with a blank title is still kept (stored with an empty title - see the
 * slug-strategy note on why title and slug are handled differently) rather
 * than being skipped entirely - skipping discarded the WHOLE row on save,
 * silently dropping shortDescription/description/meta the admin never
 * touched just because title+slug were cleared. Only a locale with
 * genuinely nothing entered anywhere is skipped, so we still never insert a
 * fully-empty row.
 *
 * Slug strategy:
 *   - Default locale uses `data.slug` if provided, else `slugify(title)` +
 *     a short suffix so multiple new products with similar titles don't
 *     collide on the global `(locale, slug)` unique index.
 *   - Non-default locales derive slug from `slugify(translatedTitle)` and
 *     fall back to `{defaultSlug}-{locale}` when slugify produces an empty
 *     result (e.g. when the translated title is all-symbols).
 */
function buildProductTranslationRows(
  data: ProductMutationFields,
  suffix?: string,
): ProductTranslationRow[] {
  const defaultSlug =
    (data.slug?.trim() || slugify(data.title)) +
    (suffix ? `-${suffix}` : "");

  const rows: ProductTranslationRow[] = [
    {
      locale: DEFAULT_LOCALE,
      title: data.title.trim(),
      slug: defaultSlug,
      description: data.description,
      shortDescription: data.shortDescription?.trim() || null,
      metaTitle: data.metaTitle?.trim() || null,
      metaDescription: data.metaDescription?.trim() || null,
    },
  ];

  for (const locale of NON_DEFAULT_LOCALES) {
    const t = data.translations?.[locale];
    const title = t?.title?.trim();
    const explicitSlug = t?.slug?.trim();
    const description = t?.description?.trim();
    const shortDescription = t?.shortDescription?.trim();
    const metaTitle = t?.metaTitle?.trim();
    const metaDescription = t?.metaDescription?.trim();
    // Nothing entered anywhere for this locale - genuinely nothing to save.
    if (
      !title &&
      !explicitSlug &&
      !description &&
      !shortDescription &&
      !metaTitle &&
      !metaDescription
    ) {
      continue;
    }
    // `slug` is `@@unique([locale, slug])` - it can never be blank (two
    // products both left with an empty slug would collide), so it still
    // needs a real, derived fallback even when title is blank. `title` has
    // no such constraint, so it's stored exactly as typed (possibly blank);
    // `getProductTitle` falls back to the default locale's title at DISPLAY
    // time instead, so a shopper never sees a blank title but the admin
    // form still shows this locale's title as genuinely empty - not
    // silently refilled with the English title - when they clear it.
    const effectiveTitle = title || data.title.trim();
    // The uniqueness suffix has to reach EVERY locale, not just the default
    // one: `@@unique([locale, slug])` is enforced per row, so a retry that only
    // suffixed the default row still collided on the translated ones and the
    // whole create failed with "already exists". The `${defaultSlug}-${locale}`
    // fallback already carries the suffix via `defaultSlug`.
    const derivedSlug = explicitSlug || slugify(effectiveTitle);
    const slug = derivedSlug
      ? derivedSlug + (suffix ? `-${suffix}` : "")
      : `${defaultSlug}-${locale}`;
    rows.push({
      locale,
      title: title ?? "",
      slug,
      description: description || data.description,
      shortDescription: shortDescription ?? null,
      metaTitle: metaTitle ?? null,
      metaDescription: metaDescription ?? null,
    });
  }

  return rows;
}

async function syncProductMedia(
  tx: TransactionClient,
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
          deleteS3Object(toEmailThumbKey(m.key, m.thumbKey)).catch(() => {}),
        ];
      }),
    );
  }

  // Keep each insert's index within the full `media` array - that index IS its
  // final `order`. Using the position in the filtered `toInsert` subset instead
  // would clash with the orders of the retained rows (e.g. a video appended at
  // position 3 would land on `order: 0`), producing duplicate `order` values
  // and an unstable `orderBy: { order: "asc" }` on every read.
  const toInsert = media
    .map((m, index) => ({ media: m, index }))
    .filter(({ media: m }) => !existingMap.has(m.key));

  if (toInsert.length > 0) {
    await tx.productMedia.createMany({
      data: toInsert.map(({ media: m, index }) => ({
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
      toInsert.map(({ media: m }) =>
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
  options: { attributeId: string; optionId: string }[] | undefined,
): string | null {
  if (!options || options.length === 0) return null;
  return [...options]
    .map((o) => `${o.attributeId}:${o.optionId}`)
    .sort()
    .join("|");
}

async function syncVariants(
  tx: TransactionClient,
  productId: string,
  variants: ProductVariantInput[],
  mediaIdByKey: Map<string, string>,
) {
  const existing = await tx.productVariant.findMany({
    where: { productId },
    include: { attributeValues: true },
  });

  const existingBySignature = new Map<string, (typeof existing)[number]>();
  const existingBySku = new Map<string, (typeof existing)[number]>();
  for (const v of existing) {
    const sig = variantSignature(
      v.attributeValues.map((av) => ({
        attributeId: av.attributeId,
        optionId: av.optionId,
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
          `Duplicate variant option combination: ${sig.replace(/ /g, "=").replace(/|/g, ", ")}`,
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

    // Replace-all the variant's axis values (controlled AttributeOption refs).
    await tx.productVariantAttributeValue.deleteMany({
      where: { variantId: variant.id },
    });
    const axisRows = (variant.options ?? []).map((o) => ({
      variantId: variant.id!,
      attributeId: o.attributeId,
      optionId: o.optionId,
    }));
    if (axisRows.length > 0) {
      await tx.productVariantAttributeValue.createMany({ data: axisRows });
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

/**
 * Refreshes the per-locale search blob (`ProductTranslation.searchText`) for
 * one product. Mirrors the public search expectations: each locale's blob
 * concatenates the localized title + shortDescription, the brand's name in
 * that locale (fallback to default), and the names of all linked categories
 * and tags in that locale (fallback to default). The GIN trigram index on the
 * column makes `contains` searches fast within each locale.
 */
export async function refreshProductSearchText(
  tx: TransactionClient,
  productId: string,
): Promise<void> {
  const p = await tx.product.findFirst({
    where: { id: productId },
    select: {
      translations: {
        select: {
          locale: true,
          title: true,
          shortDescription: true,
        },
      },
      brand: {
        select: {
          translations: { select: { locale: true, name: true } },
        },
      },
      categories: {
        select: {
          category: {
            select: {
              translations: { select: { locale: true, name: true } },
            },
          },
        },
      },
      tags: {
        select: {
          tag: {
            select: {
              translations: { select: { locale: true, name: true } },
            },
          },
        },
      },
    },
  });
  if (!p) return;

  function pick<T extends { locale: string }>(rows: T[], locale: string): T | undefined {
    return (
      rows.find((r) => r.locale === locale) ??
      rows.find((r) => r.locale === DEFAULT_LOCALE)
    );
  }

  // Build a complete searchText for every supported locale - even the ones
  // without a translated title yet - so search in any UI language matches.
  // Locales without a product translation row simply get an empty title slot
  // (still indexable on brand/category names).
  for (const locale of SUPPORTED_LOCALES) {
    const productT = p.translations.find((t) => t.locale === locale);
    const brandT = p.brand ? pick(p.brand.translations, locale) : null;

    const parts: string[] = [];
    if (productT?.title) parts.push(productT.title);
    if (productT?.shortDescription) parts.push(productT.shortDescription);
    if (brandT?.name) parts.push(brandT.name);
    for (const c of p.categories) {
      const catT = pick(c.category.translations, locale);
      if (catT?.name) parts.push(catT.name);
    }
    for (const t of p.tags) {
      const tagT = pick(t.tag.translations, locale);
      if (tagT?.name) parts.push(tagT.name);
    }

    const searchText = parts.filter((s) => s.trim().length > 0).join(" ");

    // Only existing ProductTranslation rows get an updated searchText; we
    // don't fabricate empty translation rows for locales the seller hasn't
    // entered yet.
    if (productT) {
      await tx.productTranslation.updateMany({
        where: { productId, locale },
        data: { searchText },
      });
    }
  }
}

/**
 * Sync the ProductTranslation rows for a product using replace-all semantics:
 * delete all existing rows then insert the freshly-built rows. Translation
 * rows are tiny and at most {locale count} per product, so the simplicity of
 * the replace-all strategy is worth the few extra writes vs a per-locale diff.
 */
async function syncProductTranslations(
  tx: TransactionClient,
  productId: string,
  rows: ProductTranslationRow[],
): Promise<void> {
  // Capture the slugs as they are now so any rename can be retired into the
  // slug-history table (powers old-URL -> current-URL 308 redirects).
  const before = await tx.productTranslation.findMany({
    where: { productId },
    select: { locale: true, slug: true },
  });
  await tx.productTranslation.deleteMany({ where: { productId } });
  await tx.productTranslation.createMany({
    data: rows.map((r) => ({ ...r, productId })),
  });
  await recordSlugChanges(
    tx,
    "PRODUCT",
    productId,
    new Map(before.map((r) => [r.locale, r.slug])),
    new Map(rows.map((r) => [r.locale, r.slug])),
  );
}

/**
 * Serializes the current ProductTranslation rows into the JSON shape stored
 * on ProductHistory.translationsSnap for point-in-time rollback. Returns
 * Prisma.JsonNull when there are no translations to capture (defensive only
 * - every product should have at least the default-locale row).
 */
function buildHistoryTranslationsSnap(
  rows: { locale: string; title: string; slug: string; description: string; shortDescription: string | null; metaTitle: string | null; metaDescription: string | null }[],
): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  if (rows.length === 0) return Prisma.JsonNull;
  const snap: Record<string, unknown> = {};
  for (const r of rows) {
    snap[r.locale] = {
      title: r.title,
      slug: r.slug,
      description: r.description,
      shortDescription: r.shortDescription,
      metaTitle: r.metaTitle,
      metaDescription: r.metaDescription,
    };
  }
  return snap as Prisma.InputJsonValue;
}

/**
 * Pick the default-locale row from a ProductTranslation list, falling back
 * to the first available row. Used for ProductHistory.title/.description and
 * for any UI surface that needs a single representative string.
 */
function defaultTranslation<
  T extends { locale: string; title?: string; description?: string },
>(rows: readonly T[]): T | undefined {
  return rows.find((r) => r.locale === DEFAULT_LOCALE) ?? rows[0];
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

  if (filter.noTag) {
    where.tags = { none: {} };
  } else if (filter.tagId?.length) {
    where.tags = { some: { tagId: { in: filter.tagId } } };
  }

  if (filter.status?.length) {
    where.status = { in: filter.status as ProductStatus[] };
  }

  if (filter.minPrice != null || filter.maxPrice != null) {
    where.price = {};
    if (filter.minPrice != null) where.price.gte = filter.minPrice;
    if (filter.maxPrice != null) where.price.lte = filter.maxPrice;
  }

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
    where.translations = {
      some: { title: { contains: filter.titleContains, mode: "insensitive" } },
    };
  }

  return where;
}

/**
 * Filter facets shared by the admin/seller product list and its disjunctive
 * facet counts. `omit` drops one dimension from the clause so a facet's own
 * selection doesn't constrain its own counts (Amazon/GitHub-style: each
 * status/brand stays countable while one is selected).
 */
type AdminProductFilterParams = {
  status?: ProductStatus[];
  minPrice?: number;
  maxPrice?: number;
  createdBy?: string[];
  updatedBy?: string;
  brandId?: string[];
  search?: string;
  searchLocale?: string;
};

function buildAdminProductWhere(
  organizationId: string,
  params: AdminProductFilterParams,
  omit?: "status" | "brand" | "createdBy",
): Prisma.ProductWhereInput {
  const where: Prisma.ProductWhereInput = {
    organizationId,
    deletedAt: null,
  };

  if (omit !== "status" && params.status?.length) where.status = { in: params.status };

  if (params.minPrice != null || params.maxPrice != null) {
    where.price = {};
    if (params.minPrice != null) where.price.gte = params.minPrice;
    if (params.maxPrice != null) where.price.lte = params.maxPrice;
  }

  if (omit !== "createdBy" && params.createdBy?.length) where.createdById = { in: params.createdBy };
  if (params.updatedBy) where.updatedById = params.updatedBy;
  if (omit !== "brand" && params.brandId?.length) where.brandId = { in: params.brandId };

  if (params.search) {
    const searchClause = params.searchLocale
      ? {
          some: {
            locale: params.searchLocale,
            searchText: { contains: params.search, mode: "insensitive" as const },
          },
        }
      : {
          some: {
            searchText: { contains: params.search, mode: "insensitive" as const },
          },
        };

    where.OR = [
      { translations: searchClause },
      { barcode: { contains: params.search, mode: "insensitive" } },
    ];
  }

  return where;
}

/** Form input shape for a single product attribute value. */
export type ProductAttributeInput = {
  attributeId: string;
  optionIds?: string[];
  valueNumeric?: number | null;
  valueBool?: boolean | null;
};

/**
 * Replace-all sync of a product's attribute values. Each input entry expands
 * to one ProductAttributeValue row per selected option (MULTI_SELECT), or a
 * single numeric/boolean row. Entries without any value are skipped.
 */
async function syncProductAttributes(
  tx: TransactionClient,
  productId: string,
  attributes: ProductAttributeInput[],
): Promise<void> {
  await tx.productAttributeValue.deleteMany({ where: { productId } });

  const rows: {
    productId: string;
    attributeId: string;
    optionId: string | null;
    valueNumeric: number | null;
    valueBool: boolean | null;
  }[] = [];

  for (const a of attributes) {
    if (a.optionIds && a.optionIds.length > 0) {
      for (const optionId of a.optionIds) {
        rows.push({
          productId,
          attributeId: a.attributeId,
          optionId,
          valueNumeric: null,
          valueBool: null,
        });
      }
    } else if (a.valueNumeric != null) {
      rows.push({
        productId,
        attributeId: a.attributeId,
        optionId: null,
        valueNumeric: a.valueNumeric,
        valueBool: null,
      });
    } else if (a.valueBool != null) {
      rows.push({
        productId,
        attributeId: a.attributeId,
        optionId: null,
        valueNumeric: null,
        valueBool: a.valueBool,
      });
    }
  }

  if (rows.length > 0) {
    await tx.productAttributeValue.createMany({ data: rows });
  }
}

// ---------- Shared include payloads ----------

const productWithRelationsInclude = {
  translations: true,
  // `id` breaks ties deterministically so equal `order` values (e.g. legacy
  // rows written before the insert-order fix) never sort unstably per query.
  media: { orderBy: [{ order: "asc" } as const, { id: "asc" } as const] },
  brand: { select: { id: true, logoUrl: true, logoUrlDark: true, logoBackdrop: true, logoBackdropDark: true, translations: true } },
  variants: {
    orderBy: { order: "asc" } as const,
    include: {
      attributeValues: {
        include: {
          attribute: { select: { id: true, key: true, type: true, translations: true } },
          option: { select: { id: true, value: true, translations: true } },
        },
      },
      media: {
        orderBy: { order: "asc" } as const,
        include: { media: true },
      },
    },
  },
  categories: {
    include: {
      category: {
        select: { id: true, parentId: true, translations: true },
      },
    },
  },
  tags: {
    include: {
      tag: {
        select: { id: true, translations: true },
      },
    },
  },
  attributeValues: {
    select: {
      attributeId: true,
      optionId: true,
      valueNumeric: true,
      valueBool: true,
    },
  },
} satisfies Prisma.ProductInclude;

export function productRepository(
  ctx: Pick<RequestContext, "organizationId" | "userId">,
) {
  const db = tenantPrisma({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
  });

  type SortField = "createdAt" | "price" | "status";
  type SortOrder = "asc" | "desc";

  return {
    async getById(id: string): Promise<ProductWithRelations | null> {
      return db.prisma.product.findFirst({
        where: {
          id,
          organizationId: ctx.organizationId,
          deletedAt: null,
        },
        include: productWithRelationsInclude,
      });
    },

    async getAll(params?: {
      take?: number;
      cursor?: string;
      status?: ProductStatus[];
      minPrice?: number;
      maxPrice?: number;
      createdBy?: string[];
      updatedBy?: string;
      search?: string;
      /** Locale to scope search against. Defaults to all locales (admin-wide). */
      searchLocale?: string;
      sortBy?: SortField;
      sortOrder?: SortOrder;
      brandId?: string[];
    }): Promise<{
      products: AdminProductListItem[];
      nextCursor?: string;
    }> {
      const take = params?.take ?? 20;
      const cursor = params?.cursor;

      const where = buildAdminProductWhere(ctx.organizationId, params ?? {});

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
          translations: true,
          media: {
            take: 5,
            orderBy: [{ order: "asc" }, { id: "asc" }],
          },
          brand: {
            select: { id: true, logoUrl: true, logoUrlDark: true, logoBackdrop: true, logoBackdropDark: true, translations: true },
          },
          createdBy: {
            select: { id: true, name: true, email: true },
          },
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

    /**
     * Disjunctive facet counts for the product list sidebar. Status counts
     * ignore the active status selection (every status stays countable while
     * one is checked); brand/createdBy counts likewise ignore their own
     * selection. All other filters (search, price, the *other* dimensions)
     * still apply, so the numbers track the current result set the way
     * Amazon/GitHub facets do.
     */
    async getFilterCounts(params: AdminProductFilterParams): Promise<{
      status: Record<string, number>;
      brand: Record<string, number>;
      createdBy: Record<string, number>;
    }> {
      const [statusGroups, brandGroups, createdByGroups] = await Promise.all([
        db.prisma.product.groupBy({
          by: ["status"],
          where: buildAdminProductWhere(ctx.organizationId, params, "status"),
          _count: { _all: true },
        }),
        db.prisma.product.groupBy({
          by: ["brandId"],
          where: {
            AND: [
              buildAdminProductWhere(ctx.organizationId, params, "brand"),
              { brandId: { not: null } },
            ],
          },
          _count: { _all: true },
        }),
        db.prisma.product.groupBy({
          by: ["createdById"],
          where: {
            AND: [
              buildAdminProductWhere(ctx.organizationId, params, "createdBy"),
              { createdById: { not: null } },
            ],
          },
          _count: { _all: true },
        }),
      ]);

      const status: Record<string, number> = {};
      for (const g of statusGroups) status[g.status] = g._count._all;
      const brand: Record<string, number> = {};
      for (const g of brandGroups) if (g.brandId) brand[g.brandId] = g._count._all;
      const createdBy: Record<string, number> = {};
      for (const g of createdByGroups) if (g.createdById) createdBy[g.createdById] = g._count._all;
      return { status, brand, createdBy };
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
      tagIds?: string[];
      media?: MediaInput[];
      variants?: ProductVariantInput[];
      attributes?: ProductAttributeInput[];
      /** Defaults to DRAFT; only the bulk-import path passes a non-default value. */
      status?: ProductStatus;
    }): Promise<ProductWithRelations> {
      const runCreate = async (
        suffix?: string,
      ): Promise<ProductWithRelations> => {
        const translationRows = buildProductTranslationRows(data, suffix);

        return db.prisma.$transaction(async (tx) => {
          const created = await tx.product.create({
            data: {
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
              brandId: data.brandId,
              status: data.status ?? "DRAFT",
              ...(data.status === "PUBLISHED" && { publishedAt: new Date() }),
              organizationId: ctx.organizationId,
              createdById: ctx.userId,
              translations: { create: translationRows },
            },
          });

          // Reclaim these slugs from history in case a since-deleted entity had
          // retired them - a live product's URL must never 308 elsewhere.
          await recordSlugChanges(
            tx,
            "PRODUCT",
            created.id,
            new Map(),
            new Map(translationRows.map((r) => [r.locale, r.slug])),
          );

          const mediaIdByKey = data?.media?.length
            ? await syncProductMedia(tx, created.id, data.media)
            : new Map<string, string>();

          if (data?.variants?.length) {
            await syncVariants(tx, created.id, data.variants, mediaIdByKey);
          }

          if (data?.categoryIds?.length) {
            await tx.productCategory.createMany({
              data: data.categoryIds.map((categoryId) => ({
                productId: created.id,
                categoryId,
              })),
              skipDuplicates: true,
            });
          }

          if (data?.tagIds?.length) {
            await tx.productTag.createMany({
              data: data.tagIds.map((tagId) => ({
                productId: created.id,
                tagId,
              })),
              skipDuplicates: true,
            });
          }

          if (data?.attributes?.length) {
            await syncProductAttributes(tx, created.id, data.attributes);
          }

          await refreshProductSearchText(tx, created.id);

          const defaultRow = translationRows.find(
            (r) => r.locale === DEFAULT_LOCALE,
          )!;
          await tx.productHistory.create({
            data: {
              productId: created.id,
              version: 1,
              title: defaultRow.title,
              description: defaultRow.description,
              translationsSnap: buildHistoryTranslationsSnap(translationRows),
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
            include: productWithRelationsInclude,
          });

          if (!createdProduct) {
            throw new NotFoundError(
              `Product ${created.id} not found after create`,
            );
          }

          return createdProduct;
        });
      };

      const product = await createWithUniqueSlugRetry(runCreate);

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
        tagIds?: string[];
        media?: MediaInput[];
        status?: ProductStatus;
        variants?: ProductVariantInput[];
        attributes?: ProductAttributeInput[];
      }>,
    ): Promise<ProductWithRelations> {
      const product = await db.prisma.$transaction(async (tx) => {
        if (!version || version < 1) {
          throw new VersionRequiredError();
        }

        const {
          media,
          variants,
          attributes,
          weightUnit,
          dimensionUnit,
          categoryIds,
          tagIds,
          translations,
          title,
          slug,
          description,
          shortDescription,
          metaTitle,
          metaDescription,
          ...productScalars
        } = data;

        // A translation-touching update is one that touches any field that
        // ends up on a ProductTranslation row. If none of these are present
        // we leave translation rows alone (just bump scalar fields).
        const translationFieldsTouched =
          title !== undefined ||
          slug !== undefined ||
          description !== undefined ||
          shortDescription !== undefined ||
          metaTitle !== undefined ||
          metaDescription !== undefined ||
          translations !== undefined;

        const result = await tx.product.updateMany({
          where: {
            id,
            organizationId: ctx.organizationId,
            version,
            deletedAt: null,
          },
          data: {
            ...productScalars,
            ...(weightUnit !== undefined && { weightUnit: weightUnit as never }),
            ...(dimensionUnit !== undefined && { dimensionUnit: dimensionUnit as never }),
            updatedById: ctx.userId,
            version: { increment: 1 },
          },
        });

        if (result.count === 0) {
          throw new ConcurrencyConflictError();
        }

        // When the form touched any translatable field, rebuild the full
        // translation set from the inputs. The form always submits the full
        // current state, so we treat absent fields on a translation-touch as
        // explicit "no value".
        if (translationFieldsTouched) {
          const existing = await tx.productTranslation.findUnique({
            where: { productId_locale: { productId: id, locale: DEFAULT_LOCALE } },
          });
          const newRows = buildProductTranslationRows({
            title: title ?? existing?.title ?? "",
            slug: slug ?? existing?.slug,
            description: description ?? existing?.description ?? "",
            shortDescription:
              shortDescription ?? existing?.shortDescription ?? undefined,
            metaTitle: metaTitle ?? existing?.metaTitle ?? undefined,
            metaDescription:
              metaDescription ?? existing?.metaDescription ?? undefined,
            translations,
          });
          await syncProductTranslations(tx, id, newRows);
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

        if (categoryIds !== undefined) {
          await tx.productCategory.deleteMany({ where: { productId: id } });
          if (categoryIds.length > 0) {
            await tx.productCategory.createMany({
              data: categoryIds.map((categoryId) => ({ productId: id, categoryId })),
              skipDuplicates: true,
            });
          }
        }

        if (tagIds !== undefined) {
          await tx.productTag.deleteMany({ where: { productId: id } });
          if (tagIds.length > 0) {
            await tx.productTag.createMany({
              data: tagIds.map((tagId) => ({ productId: id, tagId })),
              skipDuplicates: true,
            });
          }
        }

        if (attributes !== undefined) {
          await syncProductAttributes(tx, id, attributes);
        }

        await refreshProductSearchText(tx, id);

        const updatedProduct = await tx.product.findFirst({
          where: {
            id,
            organizationId: ctx.organizationId,
            deletedAt: null,
            version: version + 1,
          },
          include: productWithRelationsInclude,
        });

        if (!updatedProduct) {
          throw new NotFoundError(`Product ${id} not found after update`);
        }

        const defaultRow =
          defaultTranslation(updatedProduct.translations) ??
          { title: "", description: "" };
        await tx.productHistory.create({
          data: {
            productId: updatedProduct.id,
            version: updatedProduct.version,
            title: defaultRow.title,
            description: defaultRow.description,
            translationsSnap: buildHistoryTranslationsSnap(
              updatedProduct.translations,
            ),
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
            deleteS3Object(toEmailThumbKey(m.key, m.thumbKey)).catch(() => {}),
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

      // Reconstruct the per-locale form input from `translationsSnap`. Older
      // ProductHistory rows (pre-translation-table migration) don't carry
      // translationsSnap; for those we can only roll back the default-locale
      // title/description that lived on the canonical history row.
      const snap = history.translationsSnap as Record<string, {
        title?: string;
        slug?: string;
        description?: string;
        shortDescription?: string;
        metaTitle?: string;
        metaDescription?: string;
      }> | null;

      const defaultSnap = snap?.[DEFAULT_LOCALE];
      const rollbackTranslations: ProductTranslationsInput | null = snap
        ? Object.fromEntries(
            NON_DEFAULT_LOCALES.filter((loc) => snap[loc]).map((loc) => [
              loc,
              {
                title: snap[loc]?.title,
                description: snap[loc]?.description,
                shortDescription: snap[loc]?.shortDescription,
                metaTitle: snap[loc]?.metaTitle,
                metaDescription: snap[loc]?.metaDescription,
              },
            ]),
          )
        : null;

      return this.update(productId, currentProduct.version, {
        title: defaultSnap?.title ?? history.title,
        slug: defaultSnap?.slug,
        description: defaultSnap?.description ?? history.description,
        shortDescription: defaultSnap?.shortDescription,
        metaTitle: defaultSnap?.metaTitle,
        metaDescription: defaultSnap?.metaDescription,
        translations: rollbackTranslations,
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
          include: { translations: true },
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

          const defaultRow = defaultTranslation(product.translations);
          await tx.productHistory.create({
            data: {
              productId: updated.id,
              version: updated.version,
              title: defaultRow?.title ?? "",
              description: defaultRow?.description ?? "",
              translationsSnap: buildHistoryTranslationsSnap(product.translations),
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
        revalidateProductHistoryCache(ctx.organizationId, product.id);
      }

      return updatedProducts;
    },

    async duplicate(id: string): Promise<ProductWithRelations> {
      // 1. Fetch the source product with all relations needed for duplication.
      const source = await db.prisma.product.findFirst({
        where: { id, organizationId: ctx.organizationId, deletedAt: null },
        include: {
          translations: true,
          media: { orderBy: { order: "asc" } },
          variants: {
            orderBy: { order: "asc" },
            include: {
              attributeValues: { select: { attributeId: true, optionId: true } },
              media: {
                orderBy: { order: "asc" },
                include: { media: { select: { key: true } } },
              },
            },
          },
          attributeValues: {
            select: {
              attributeId: true,
              optionId: true,
              valueNumeric: true,
              valueBool: true,
            },
          },
        },
      });

      if (!source) {
        throw new NotFoundError(`Product ${id} not found`);
      }

      // 2. Copy S3 media server-side (pure S3 CopyObject - no re-upload).
      const keyMap = new Map<string, string>();
      const copiedKeys: string[] = [];

      try {
        await Promise.all(
          source.media.map(async (m) => {
            const newKey = m.key.replace(/[^/]+$/, randomUUID());
            await copyProductImage(m.key, newKey);
            keyMap.set(m.key, newKey);
            copiedKeys.push(newKey);
          }),
        );
      } catch (err) {
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
        options: v.attributeValues.map((av) => ({
          attributeId: av.attributeId,
          optionId: av.optionId,
        })),
      }));

      // Collapse the source's attribute value rows back into the per-attribute
      // input shape (one entry, with all selected options grouped together).
      const attributesByAttr = new Map<string, ProductAttributeInput>();
      for (const av of source.attributeValues) {
        let entry = attributesByAttr.get(av.attributeId);
        if (!entry) {
          entry = { attributeId: av.attributeId, optionIds: [], valueNumeric: null, valueBool: null };
          attributesByAttr.set(av.attributeId, entry);
        }
        if (av.optionId) entry.optionIds!.push(av.optionId);
        else if (av.valueNumeric != null) entry.valueNumeric = av.valueNumeric;
        else if (av.valueBool != null) entry.valueBool = av.valueBool;
      }
      const attributes = [...attributesByAttr.values()];

      // Rebuild the form translations input from the source ProductTranslation
      // rows so the duplicate carries every locale, not just the default one.
      // Each locale gets a "Copy of" title (the admin list shows the viewer
      // locale's title) and an explicitly suffixed slug - create() only
      // suffixes the DEFAULT locale's slug, so an unchanged translated title
      // would re-derive the source's slug and violate the (locale, slug)
      // unique index ("already exists" on products that have translations).
      const defaultRow = defaultTranslation(source.translations);
      const sourceTranslations: ProductTranslationsInput = {};
      for (const t of source.translations) {
        if (t.locale === DEFAULT_LOCALE) continue;
        sourceTranslations[t.locale as keyof ProductTranslationsInput] = {
          title: copyName(t.locale, t.title),
          slug: `${t.slug}-copy-${suffix}`,
          description: t.description,
          shortDescription: t.shortDescription ?? undefined,
          metaTitle: t.metaTitle ?? undefined,
          metaDescription: t.metaDescription ?? undefined,
        };
      }

      // 4. Create the duplicate.  On DB failure, clean up the copied S3 objects.
      try {
        return await this.create({
          title: copyName(DEFAULT_LOCALE, defaultRow?.title ?? ""),
          description: defaultRow?.description ?? "",
          shortDescription: defaultRow?.shortDescription ?? undefined,
          metaTitle: defaultRow?.metaTitle ?? undefined,
          metaDescription: defaultRow?.metaDescription ?? undefined,
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
          translations:
            Object.keys(sourceTranslations).length > 0 ? sourceTranslations : null,
          brandId: source.brandId ?? undefined,
          media: media.length > 0 ? media : undefined,
          variants: variants.length > 0 ? variants : undefined,
          attributes: attributes.length > 0 ? attributes : undefined,
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
            price: true,
            status: true,
            translations: {
              where: { locale: DEFAULT_LOCALE },
              select: { title: true },
            },
            brand: {
              select: {
                translations: {
                  where: { locale: DEFAULT_LOCALE },
                  select: { name: true },
                },
              },
            },
          },
        }),
      ]);

      return {
        count,
        samples: samples.map((p) => ({
          id: p.id,
          title: p.translations[0]?.title ?? "",
          price: p.price,
          status: p.status,
          brand: p.brand?.translations[0]
            ? { name: p.brand.translations[0].name }
            : null,
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
        p.media.flatMap((m) => [
          m.key,
          m.thumbKey ?? toThumbKey(m.key),
          toEmailThumbKey(m.key, m.thumbKey),
        ]),
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
          price: true,
          status: true,
          translations: true,
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
        tags,
      } = updates;

      const stockUpdateRequested = stock !== undefined;
      const stockEligible = stockUpdateRequested
        ? products.filter((p) => p._count.variants === 0)
        : products;
      const skippedWithVariants = stockUpdateRequested
        ? products.length - stockEligible.length
        : 0;

      const baseIds = products.map((p) => p.id);
      const stockIds = stockEligible.map((p) => p.id);

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
        categories === undefined &&
        tags === undefined;
      if (onlyStockChange && stockIds.length === 0) {
        return { count: 0, skippedWithVariants };
      }

      const productIds = baseIds;

      const categoryMutationRequested =
        categories !== undefined && categories.mode !== undefined;
      const tagMutationRequested = tags !== undefined && tags.mode !== undefined;

      // Category/tag mutations rebuild search text per product (N+1 in-txn).
      // Guard against a broad filter opening a long, lock-heavy transaction.
      if (
        (categoryMutationRequested || tagMutationRequested) &&
        productIds.length > BULK_CATEGORY_MUTATION_LIMIT
      ) {
        throw new BulkLimitExceededError({
          key: "bulkCategoryLimit",
          params: { limit: BULK_CATEGORY_MUTATION_LIMIT, count: productIds.length },
        });
      }

      await db.prisma.$transaction(async (tx) => {
        const hasNonStockScalarUpdate =
          status !== undefined ||
          brandId !== undefined ||
          price !== undefined ||
          compareAtPrice !== undefined ||
          costPrice !== undefined ||
          taxable !== undefined ||
          requiresShipping !== undefined ||
          isDigital !== undefined;

        if (hasNonStockScalarUpdate || categoryMutationRequested || tagMutationRequested) {
          await tx.product.updateMany({
            where: {
              id: { in: productIds },
              organizationId: ctx.organizationId,
              deletedAt: null,
            },
            data: scalarUpdates,
          });
        }

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
              ...(hasNonStockScalarUpdate || categoryMutationRequested || tagMutationRequested
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

          for (const id of productIds) {
            await refreshProductSearchText(tx, id);
          }
        }

        if (tagMutationRequested && tags) {
          if (tags.mode === "set") {
            await tx.productTag.deleteMany({
              where: { productId: { in: productIds } },
            });
            if (tags.ids.length > 0) {
              await tx.productTag.createMany({
                data: productIds.flatMap((productId) =>
                  tags.ids.map((tagId) => ({ productId, tagId })),
                ),
                skipDuplicates: true,
              });
            }
          } else if (tags.mode === "add" && tags.ids.length > 0) {
            await tx.productTag.createMany({
              data: productIds.flatMap((productId) =>
                tags.ids.map((tagId) => ({ productId, tagId })),
              ),
              skipDuplicates: true,
            });
          } else if (tags.mode === "remove" && tags.ids.length > 0) {
            await tx.productTag.deleteMany({
              where: {
                productId: { in: productIds },
                tagId: { in: tags.ids },
              },
            });
          }

          for (const id of productIds) {
            await refreshProductSearchText(tx, id);
          }
        }

        if (status !== undefined || price !== undefined) {
          for (const p of products) {
            const defaultRow = defaultTranslation(p.translations);
            await tx.productHistory.create({
              data: {
                productId: p.id,
                version: p.version + 1,
                title: defaultRow?.title ?? "",
                description: defaultRow?.description ?? "",
                translationsSnap: buildHistoryTranslationsSnap(p.translations),
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

      const historyWritten = status !== undefined || price !== undefined;
      for (const p of products) {
        revalidateProductCache(ctx.organizationId, p.id);
        if (historyWritten) revalidateProductHistoryCache(ctx.organizationId, p.id);
      }

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
        product.media.flatMap((m) => [
          m.key,
          m.thumbKey ?? toThumbKey(m.key),
          toEmailThumbKey(m.key, m.thumbKey),
        ]),
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

export type ProductRepo = ReturnType<typeof productRepository>;
