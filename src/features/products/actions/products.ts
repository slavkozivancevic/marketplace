"use server";

import { redirect } from "next/navigation";
import { decimalToCents } from "@/lib/currency";
import { prisma } from "@/core/db/prisma";
import {
  createProductSchema,
  updateProductSchema,
  CreateProductInput,
  UpdateProductInput,
} from "../schema/products";
import { handleActionError } from "@/features/common/errors/domainErrors";
import { ProductStatus } from "@/generated/prisma/client";
import { productRepository } from "../db/products";
import { ActionErrorResult } from "@/types/types";
import type { BulkFilter, BulkUpdateFields } from "../types/bulk";
import { requirePermission } from "@/lib/auth/permissions";
import { resolveRequestContext } from "@/lib/auth/resolveRequestContext";
import {
  publishProduct as workflowPublish,
  unpublishProduct as workflowUnpublish,
  archiveProduct as workflowArchive,
  unarchiveProduct as workflowUnarchive,
} from "../services/productWorkflow";

/**
 * Shape of a single row from the CSV import.
 *
 * Brand / category references arrive as human-friendly strings (slug or UUID)
 * and are resolved server-side once per import so the per-row create() calls
 * only see canonical IDs.
 */
export type BulkCreateRow = {
  title: string;
  slug?: string;
  description: string;
  shortDescription?: string;
  price: number;
  compareAtPrice?: number;
  costPrice?: number;
  stock?: number;
  barcode?: string;
  taxable?: boolean;
  taxCode?: string;
  requiresShipping?: boolean;
  isDigital?: boolean;
  weight?: number;
  weightUnit?: string;
  length?: number;
  width?: number;
  height?: number;
  dimensionUnit?: string;
  /** Slug, UUID, or empty. Resolved against the brands table. */
  brandRef?: string;
  /** Semicolon-separated list of category slugs / UUIDs / "parent/child" paths. */
  categoryRefs?: string[];
  metaTitle?: string;
  metaDescription?: string;
  status?: ProductStatus;
};

export type BulkCreateResult = {
  totalRows: number;
  created: number;
  errors: { row: number; message: string }[];
};

export async function createProduct(
  unsafeData: CreateProductInput,
  redirectTo = "/admin/products",
): Promise<void | ActionErrorResult> {
  try {
    const parsed = createProductSchema.safeParse(unsafeData);

    if (!parsed.success) {
      return {
        error: true,
        message: parsed.error.issues.map((i) => i.message).join(", "),
      };
    }

    const ctx = await resolveRequestContext();
    requirePermission(ctx, "product:create");
    const repo = productRepository(ctx);

    const { price, compareAtPrice, costPrice, variants, categoryIds, ...rest } = parsed.data;
    await repo.create({
      ...rest,
      categoryIds,
      price: decimalToCents(price),
      compareAtPrice: compareAtPrice != null ? decimalToCents(compareAtPrice) : null,
      costPrice: costPrice != null ? decimalToCents(costPrice) : null,
      variants: variants?.map((v) => ({
        ...v,
        price: decimalToCents(v.price),
        compareAtPrice: v.compareAtPrice != null ? decimalToCents(v.compareAtPrice) : null,
        costPrice: v.costPrice != null ? decimalToCents(v.costPrice) : null,
      })),
    });
  } catch (error) {
    return handleActionError(error);
  }

  redirect(redirectTo);
}

export async function updateProduct(
  id: string,
  unsafeData: UpdateProductInput,
  redirectTo = `/admin/products/${id}`,
): Promise<void | ActionErrorResult> {
  try {
    const parsed = updateProductSchema.safeParse(unsafeData);

    if (!parsed.success) {
      return {
        error: true,
        message: parsed.error.issues.map((i) => i.message).join(", "),
      };
    }

    const { version, ...data } = parsed.data;

    const ctx = await resolveRequestContext();
    requirePermission(ctx, "product:update");
    const repo = productRepository(ctx);

    const { price: dPrice, compareAtPrice: dCap, costPrice: dCost, variants: dVariants, categoryIds, ...restData } = data;
    await repo.update(id, version, {
      ...restData,
      categoryIds,
      ...(dPrice !== undefined && { price: decimalToCents(dPrice) }),
      ...(dCap !== undefined && { compareAtPrice: dCap != null ? decimalToCents(dCap) : null }),
      ...(dCost !== undefined && { costPrice: dCost != null ? decimalToCents(dCost) : null }),
      variants: dVariants?.map((v) => ({
        ...v,
        price: decimalToCents(v.price),
        compareAtPrice: v.compareAtPrice != null ? decimalToCents(v.compareAtPrice) : null,
        costPrice: v.costPrice != null ? decimalToCents(v.costPrice) : null,
      })),
    });
  } catch (error) {
    return handleActionError(error);
  }

  redirect(redirectTo);
}

export async function deleteProduct(
  id: string,
  redirectTo: string | null = "/admin/products",
): Promise<void | ActionErrorResult> {
  try {
    const ctx = await resolveRequestContext();
    requirePermission(ctx, "product:delete");
    const repo = productRepository(ctx);

    await repo.delete(id);
  } catch (error) {
    return handleActionError(error);
  }

  if (redirectTo) redirect(redirectTo);
}

export async function rollbackProductVersion(
  productId: string,
  targetVersion: number,
): Promise<void | ActionErrorResult> {
  try {
    const ctx = await resolveRequestContext();
    requirePermission(ctx, "product:update");
    const repo = productRepository(ctx);

    await repo.rollbackToVersion(productId, targetVersion);
  } catch (error) {
    return handleActionError(error);
  }
}

export async function publishProduct(
  productId: string,
  redirectTo = `/admin/products/${productId}`,
): Promise<void | ActionErrorResult> {
  try {
    const ctx = await resolveRequestContext();
    await workflowPublish(ctx, productId);
  } catch (error) {
    return handleActionError(error);
  }

  redirect(redirectTo);
}

export async function unpublishProduct(
  productId: string,
  redirectTo = `/admin/products/${productId}`,
): Promise<void | ActionErrorResult> {
  try {
    const ctx = await resolveRequestContext();
    await workflowUnpublish(ctx, productId);
  } catch (error) {
    return handleActionError(error);
  }

  redirect(redirectTo);
}

export async function archiveProduct(
  productId: string,
  redirectTo = `/admin/products/${productId}`,
): Promise<void | ActionErrorResult> {
  try {
    const ctx = await resolveRequestContext();
    await workflowArchive(ctx, productId);
  } catch (error) {
    return handleActionError(error);
  }

  redirect(redirectTo);
}

export async function unarchiveProduct(
  productId: string,
  redirectTo = `/admin/products/${productId}`,
): Promise<void | ActionErrorResult> {
  try {
    const ctx = await resolveRequestContext();
    await workflowUnarchive(ctx, productId);
  } catch (error) {
    return handleActionError(error);
  }

  redirect(redirectTo);
}

export async function bulkUpdateProductStatus(
  productIds: string[],
  status: ProductStatus,
): Promise<{ error: false; message: string } | ActionErrorResult> {
  try {
    const ctx = await resolveRequestContext();
    requirePermission(ctx, "product:update");
    const repo = productRepository(ctx);

    await repo.bulkUpdateStatus(productIds, status);

    return {
      error: false,
      message: `Updated ${productIds.length} product(s).`,
    };
  } catch (error) {
    return handleActionError(error);
  }
}

export async function bulkDeleteProducts(
  productIds: string[],
): Promise<{ error: false; message: string } | ActionErrorResult> {
  try {
    const ctx = await resolveRequestContext();
    requirePermission(ctx, "product:delete");
    const repo = productRepository(ctx);

    await repo.bulkDelete(productIds);

    return {
      error: false,
      message: `Deleted ${productIds.length} product(s).`,
    };
  } catch (error) {
    return handleActionError(error);
  }
}

export async function duplicateProduct(
  id: string,
): Promise<{ error: false; id: string; message: string } | ActionErrorResult> {
  try {
    const ctx = await resolveRequestContext();
    // Duplicate requires both read (to fetch) and create (to insert the copy).
    requirePermission(ctx, "product:read");
    requirePermission(ctx, "product:create");
    const repo = productRepository(ctx);

    const copy = await repo.duplicate(id);

    return { error: false, id: copy.id, message: "Product duplicated." };
  } catch (error) {
    return handleActionError(error);
  }
}

// ---------------------------------------------------------------------------
// CSV import - reference resolution helpers
// ---------------------------------------------------------------------------

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type BrandLookup = {
  byId: Map<string, string>;          // id -> id  (existence check)
  bySlug: Map<string, string>;        // slug (lower) -> id
};

type CategoryNode = {
  id: string;
  slug: string;
  parentId: string | null;
};
type CategoryLookup = {
  byId: Map<string, string>;                          // id -> id
  bySlugUnique: Map<string, string | null>;           // slug -> id when unique, null when ambiguous
  byPath: Map<string, string>;                        // "parent/child" -> id
};

async function buildBrandLookup(): Promise<BrandLookup> {
  const brands = await prisma.brand.findMany({ select: { id: true, slug: true } });
  const byId = new Map<string, string>();
  const bySlug = new Map<string, string>();
  for (const b of brands) {
    byId.set(b.id, b.id);
    bySlug.set(b.slug.toLowerCase(), b.id);
  }
  return { byId, bySlug };
}

async function buildCategoryLookup(): Promise<CategoryLookup> {
  const cats = await prisma.category.findMany({
    select: { id: true, slug: true, parentId: true },
  });

  const nodes: CategoryNode[] = cats.map((c) => ({
    id: c.id,
    slug: c.slug.toLowerCase(),
    parentId: c.parentId,
  }));

  const byId = new Map<string, string>();
  const slugCounts = new Map<string, string[]>();
  for (const n of nodes) {
    byId.set(n.id, n.id);
    const list = slugCounts.get(n.slug) ?? [];
    list.push(n.id);
    slugCounts.set(n.slug, list);
  }

  const bySlugUnique = new Map<string, string | null>();
  for (const [slug, ids] of slugCounts.entries()) {
    bySlugUnique.set(slug, ids.length === 1 ? ids[0] : null);
  }

  // Build full slug paths (e.g. "apparel/shoes/men") so users can disambiguate
  // when slugs collide across parents.
  const idToNode = new Map(nodes.map((n) => [n.id, n]));
  const byPath = new Map<string, string>();
  function pathFor(node: CategoryNode): string {
    const parts: string[] = [];
    let cur: CategoryNode | undefined = node;
    while (cur) {
      parts.unshift(cur.slug);
      cur = cur.parentId ? idToNode.get(cur.parentId) : undefined;
    }
    return parts.join("/");
  }
  for (const n of nodes) {
    byPath.set(pathFor(n), n.id);
  }

  return { byId, bySlugUnique, byPath };
}

function resolveBrand(ref: string | undefined, lookup: BrandLookup): string | undefined {
  if (!ref) return undefined;
  const trimmed = ref.trim();
  if (!trimmed) return undefined;
  if (UUID_RE.test(trimmed)) {
    const hit = lookup.byId.get(trimmed);
    if (!hit) throw new Error(`brand id "${trimmed}" not found`);
    return hit;
  }
  const hit = lookup.bySlug.get(trimmed.toLowerCase());
  if (!hit) throw new Error(`brand "${trimmed}" not found (use slug or UUID)`);
  return hit;
}

function resolveCategory(ref: string, lookup: CategoryLookup): string {
  const trimmed = ref.trim();
  if (!trimmed) throw new Error("empty category reference");

  if (UUID_RE.test(trimmed)) {
    const hit = lookup.byId.get(trimmed);
    if (!hit) throw new Error(`category id "${trimmed}" not found`);
    return hit;
  }

  const normalized = trimmed.toLowerCase();
  if (normalized.includes("/")) {
    const hit = lookup.byPath.get(normalized);
    if (!hit) throw new Error(`category path "${trimmed}" not found`);
    return hit;
  }

  const hit = lookup.bySlugUnique.get(normalized);
  if (hit === undefined) throw new Error(`category "${trimmed}" not found`);
  if (hit === null) {
    throw new Error(
      `category "${trimmed}" is ambiguous - use full path "parent/${trimmed}" or UUID`,
    );
  }
  return hit;
}

const VALID_DIMENSION_UNITS = new Set(["CM", "IN"]);
const VALID_WEIGHT_UNITS_SET = new Set(["G", "KG", "LB", "OZ"]);
const VALID_STATUSES: ReadonlySet<ProductStatus> = new Set<ProductStatus>([
  "DRAFT",
  "PUBLISHED",
  "ARCHIVED",
]);

/**
 * Bulk-create products from pre-parsed CSV rows.
 *
 * Brand / category references are resolved server-side against fresh lookup
 * tables (built once at the start of the import) so users can paste slugs or
 * full paths instead of UUIDs. Each row is processed independently - a single
 * invalid reference fails its row, not the whole import.
 */
export async function bulkCreateProducts(
  rows: BulkCreateRow[],
): Promise<{ error: false; result: BulkCreateResult } | ActionErrorResult> {
  try {
    const ctx = await resolveRequestContext();
    requirePermission(ctx, "product:create");
    const repo = productRepository(ctx);

    const [brandLookup, categoryLookup] = await Promise.all([
      buildBrandLookup(),
      buildCategoryLookup(),
    ]);

    const result: BulkCreateResult = {
      totalRows: rows.length,
      created: 0,
      errors: [],
    };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        const brandId = resolveBrand(row.brandRef, brandLookup);
        const categoryIds = (row.categoryRefs ?? [])
          .map((ref) => resolveCategory(ref, categoryLookup));

        const weightUnit = row.weightUnit ? row.weightUnit.toUpperCase() : undefined;
        if (weightUnit && !VALID_WEIGHT_UNITS_SET.has(weightUnit)) {
          throw new Error(`invalid weightUnit "${row.weightUnit}"`);
        }

        const dimensionUnit = row.dimensionUnit
          ? row.dimensionUnit.toUpperCase()
          : undefined;
        if (dimensionUnit && !VALID_DIMENSION_UNITS.has(dimensionUnit)) {
          throw new Error(`invalid dimensionUnit "${row.dimensionUnit}"`);
        }

        if (row.status && !VALID_STATUSES.has(row.status)) {
          throw new Error(`invalid status "${row.status}"`);
        }

        await repo.create({
          title: row.title,
          slug: row.slug,
          description: row.description,
          shortDescription: row.shortDescription,
          price: decimalToCents(row.price),
          compareAtPrice: row.compareAtPrice != null ? decimalToCents(row.compareAtPrice) : null,
          costPrice: row.costPrice != null ? decimalToCents(row.costPrice) : null,
          stock: row.stock ?? null,
          barcode: row.barcode,
          taxable: row.taxable ?? true,
          taxCode: row.taxCode,
          requiresShipping: row.requiresShipping ?? true,
          isDigital: row.isDigital ?? false,
          weight: row.weight ?? null,
          weightUnit: weightUnit ?? null,
          length: row.length ?? null,
          width: row.width ?? null,
          height: row.height ?? null,
          dimensionUnit: dimensionUnit ?? null,
          brandId,
          categoryIds: categoryIds.length > 0 ? categoryIds : undefined,
          metaTitle: row.metaTitle,
          metaDescription: row.metaDescription,
          status: row.status,
        });
        result.created++;
      } catch (err) {
        result.errors.push({
          row: i + 1,
          message: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    return { error: false, result };
  } catch (error) {
    return handleActionError(error);
  }
}

export type PreviewResult = {
  count: number;
  samples: {
    id: string;
    title: string;
    price: number;
    status: string;
    brand: { name: string } | null;
  }[];
};

export async function previewBulkFilter(
  filter: BulkFilter,
): Promise<{ error: false; data: PreviewResult } | ActionErrorResult> {
  try {
    const ctx = await resolveRequestContext();
    requirePermission(ctx, "product:read");
    const repo = productRepository(ctx);
    const filterInCents: BulkFilter = {
      ...filter,
      ...(filter.minPrice != null && { minPrice: decimalToCents(filter.minPrice) }),
      ...(filter.maxPrice != null && { maxPrice: decimalToCents(filter.maxPrice) }),
    };
    const data = await repo.previewByFilter(filterInCents);
    return { error: false, data };
  } catch (error) {
    return handleActionError(error);
  }
}

export async function bulkDeleteByFilter(
  filter: BulkFilter,
): Promise<{ error: false; count: number; message: string } | ActionErrorResult> {
  try {
    const ctx = await resolveRequestContext();
    requirePermission(ctx, "product:delete");
    const repo = productRepository(ctx);
    const filterInCents: BulkFilter = {
      ...filter,
      ...(filter.minPrice != null && { minPrice: decimalToCents(filter.minPrice) }),
      ...(filter.maxPrice != null && { maxPrice: decimalToCents(filter.maxPrice) }),
    };
    const { count } = await repo.bulkDeleteByFilter(filterInCents);
    return {
      error: false,
      count,
      message: count > 0 ? `Deleted ${count} product(s).` : "No products matched the filter.",
    };
  } catch (error) {
    return handleActionError(error);
  }
}

export async function bulkUpdateByFilter(
  filter: BulkFilter,
  updates: BulkUpdateFields,
): Promise<
  | { error: false; count: number; skippedWithVariants: number; message: string }
  | ActionErrorResult
> {
  try {
    const ctx = await resolveRequestContext();
    requirePermission(ctx, "product:update");
    const repo = productRepository(ctx);
    const updatesInCents: BulkUpdateFields = {
      ...updates,
      ...(updates.price !== undefined && { price: decimalToCents(updates.price) }),
      ...(updates.compareAtPrice != null && { compareAtPrice: decimalToCents(updates.compareAtPrice) }),
      ...(updates.costPrice != null && { costPrice: decimalToCents(updates.costPrice) }),
    };
    const filterInCents: BulkFilter = {
      ...filter,
      ...(filter.minPrice != null && { minPrice: decimalToCents(filter.minPrice) }),
      ...(filter.maxPrice != null && { maxPrice: decimalToCents(filter.maxPrice) }),
    };
    const { count, skippedWithVariants } = await repo.bulkUpdateByFilter(
      filterInCents,
      updatesInCents,
    );

    // Compose a message that mentions the skipped count when relevant -
    // stock writes silently drop variant products and we want users to see why
    // the affected count is smaller than the preview suggested.
    let message: string;
    if (count === 0 && skippedWithVariants === 0) {
      message = "No products matched the filter.";
    } else if (count === 0 && skippedWithVariants > 0) {
      message = `No products updated - ${skippedWithVariants} matched but stock is managed per variant for them.`;
    } else if (skippedWithVariants > 0) {
      message = `Updated ${count} product(s). Skipped ${skippedWithVariants} with variants (stock is managed per variant).`;
    } else {
      message = `Updated ${count} product(s).`;
    }

    return {
      error: false,
      count,
      skippedWithVariants,
      message,
    };
  } catch (error) {
    return handleActionError(error);
  }
}

