"use server";
import { logger } from "@/lib/logger";

import { prisma } from "@/core/db/prisma";
import { Prisma } from "@/generated/prisma/client";
import { slugify } from "@/lib/utils";
import { handleActionError } from "@/features/common/errors/domainErrors";
import { requirePermission } from "@/lib/auth/permissions";
import { resolveRequestContext } from "@/lib/auth/resolveRequestContext";
import { recordAudit } from "@/features/audit/db/audit";
import { revalidateProductCache } from "@/features/products/db/cache";
import { refreshProductSearchText } from "@/features/products/db/products";
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, isLocale } from "@/i18n/config";
import { getProductSlug } from "@/features/products/utils/translations";
import { csvEscape, TRANSLATION_CSV_COLUMNS } from "@/features/products/utils/csv";
import type { ActionErrorResult } from "@/types/types";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type TranslationImportRow = {
  /** Default-locale slug or product UUID. */
  productRef: string;
  locale: string;
  title: string;
  slug?: string;
  shortDescription?: string;
  description?: string;
  metaTitle?: string;
  metaDescription?: string;
};

export type TranslationImportResult = {
  totalRows: number;
  upserted: number;
  /** Per-row failures, keyed by a code the client localizes. */
  errors: { row: number; code: string }[];
};

/**
 * Exports every product (in the caller's org) as one CSV row per supported
 * locale, pre-filled with existing translation values. The seller translates the
 * blanks and re-imports - the standard export -> translate -> import loop.
 */
export async function exportTranslationsCsv(): Promise<
  { error: false; csv: string } | ActionErrorResult
> {
  try {
    const ctx = await resolveRequestContext();
    requirePermission(ctx, "product:read");

    const products = await prisma.product.findMany({
      where: { organizationId: ctx.organizationId, deletedAt: null },
      orderBy: { createdAt: "desc" },
      select: {
        translations: {
          select: {
            locale: true,
            title: true,
            slug: true,
            shortDescription: true,
            description: true,
            metaTitle: true,
            metaDescription: true,
          },
        },
      },
    });

    const lines: string[] = [TRANSLATION_CSV_COLUMNS.join(",")];
    for (const p of products) {
      // Stable, human-recognizable reference: the default-locale slug.
      const ref = getProductSlug(p, DEFAULT_LOCALE);
      for (const locale of SUPPORTED_LOCALES) {
        const tr = p.translations.find((t) => t.locale === locale);
        lines.push(
          [
            ref,
            locale,
            tr?.title ?? "",
            tr?.slug ?? "",
            tr?.shortDescription ?? "",
            tr?.description ?? "",
            tr?.metaTitle ?? "",
            tr?.metaDescription ?? "",
          ]
            .map(csvEscape)
            .join(","),
        );
      }
    }

    return { error: false, csv: `${lines.join("\n")}\n` };
  } catch (error) {
    return handleActionError(error);
  }
}

/** Resolves a productRef (UUID or default-locale slug) to a product id within
 *  the caller's org. Returns null when it doesn't resolve / isn't theirs. */
async function resolveProductId(
  ref: string,
  organizationId: string,
): Promise<string | null> {
  if (UUID_RE.test(ref)) {
    const p = await prisma.product.findFirst({
      where: { id: ref, organizationId, deletedAt: null },
      select: { id: true },
    });
    return p?.id ?? null;
  }
  const tr = await prisma.productTranslation.findFirst({
    where: { slug: ref, product: { organizationId, deletedAt: null } },
    select: { productId: true },
  });
  return tr?.productId ?? null;
}

/** Ensures `(locale, slug)` is unique, ignoring the product we're updating. */
async function ensureUniqueLocaleSlug(
  tx: Prisma.TransactionClient,
  locale: string,
  base: string,
  productId: string,
): Promise<string> {
  let candidate = base;
  let n = 1;
  // Bounded loop - in practice resolves on the first or second try.
  while (n < 50) {
    const clash = await tx.productTranslation.findFirst({
      where: { locale, slug: candidate, NOT: { productId } },
      select: { id: true },
    });
    if (!clash) return candidate;
    n += 1;
    candidate = `${base}-${n}`;
  }
  return `${base}-${productId.slice(-6)}`;
}

/**
 * Upserts per-locale title/description (etc.) for existing products. Each row is
 * matched to a product by productRef and applied independently so one bad row
 * never blocks the rest. Re-moderation/search index stay correct via
 * refreshProductSearchText. Org-scoped: a seller can only touch their own
 * products.
 */
export async function bulkUpsertTranslations(
  rows: TranslationImportRow[],
): Promise<{ error: false; result: TranslationImportResult } | ActionErrorResult> {
  try {
    const ctx = await resolveRequestContext();
    requirePermission(ctx, "product:update");

    const result: TranslationImportResult = {
      totalRows: rows.length,
      upserted: 0,
      errors: [],
    };
    const affected = new Set<string>();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNo = i + 1;
      try {
        if (!isLocale(row.locale)) {
          result.errors.push({ row: rowNo, code: "invalidLocale" });
          continue;
        }
        const title = row.title.trim();
        if (!title) {
          result.errors.push({ row: rowNo, code: "titleRequired" });
          continue;
        }

        const productId = await resolveProductId(row.productRef.trim(), ctx.organizationId);
        if (!productId) {
          result.errors.push({ row: rowNo, code: "productNotFound" });
          continue;
        }

        await prisma.$transaction(async (tx) => {
          const existing = await tx.productTranslation.findUnique({
            where: { productId_locale: { productId, locale: row.locale } },
            select: { slug: true, description: true },
          });
          // Description is required on the row: use the cell, else the existing
          // value, else the product's default-locale description.
          let description = row.description?.trim();
          if (!description) description = existing?.description ?? undefined;
          if (!description) {
            const def = await tx.productTranslation.findUnique({
              where: { productId_locale: { productId, locale: DEFAULT_LOCALE } },
              select: { description: true },
            });
            description = def?.description ?? title;
          }

          // Slug: explicit cell wins, else keep existing, else derive from title.
          const base =
            slugify(row.slug?.trim() || "") ||
            existing?.slug ||
            slugify(title) ||
            `${productId.slice(-8)}-${row.locale}`;
          const slug = await ensureUniqueLocaleSlug(tx, row.locale, base, productId);

          await tx.productTranslation.upsert({
            where: { productId_locale: { productId, locale: row.locale } },
            create: {
              productId,
              locale: row.locale,
              title,
              slug,
              description,
              shortDescription: row.shortDescription?.trim() || null,
              metaTitle: row.metaTitle?.trim() || null,
              metaDescription: row.metaDescription?.trim() || null,
            },
            update: {
              title,
              slug,
              description,
              shortDescription: row.shortDescription?.trim() || null,
              metaTitle: row.metaTitle?.trim() || null,
              metaDescription: row.metaDescription?.trim() || null,
            },
          });

          await refreshProductSearchText(tx, productId);
        });

        affected.add(productId);
        result.upserted += 1;
      } catch (err) {
        logger.error("[translations] row failed", rowNo, err);
        result.errors.push({ row: rowNo, code: "unknown" });
      }
    }

    for (const productId of affected) {
      revalidateProductCache(ctx.organizationId, productId);
    }

    if (result.upserted > 0) {
      await recordAudit({
        action: "product.bulk_updated",
        entityType: "Product",
        entityId: "bulk",
        diff: {
          fields: ["translations"],
          count: result.upserted,
          totalRows: result.totalRows,
          errors: result.errors.length,
        },
      });
    }

    return { error: false, result };
  } catch (error) {
    return handleActionError(error);
  }
}
