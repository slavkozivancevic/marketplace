import { prisma } from "@/core/db/prisma";
import { NotFoundError } from "@/features/common/errors/domainErrors";
import { revalidateBrandCache } from "./cache";
import { slugify } from "@/lib/utils";
import { refreshProductSearchText } from "@/features/products/db/products";
import { recordSlugChanges } from "@/lib/seo/slugHistory";
import { DEFAULT_LOCALE, NON_DEFAULT_LOCALES } from "@/i18n/config";
import { Prisma } from "@/generated/prisma/client";
import type { BrandTranslations } from "../utils/translations";

export type { BrandTranslations } from "../utils/translations";
export { getBrandName, getBrandSlug, getBrandDescription } from "../utils/translations";

type BrandTranslationRow = {
  locale: string;
  name: string;
  slug: string;
  description: string | null;
};

export type BrandListItem = {
  id: string;
  logoUrl: string | null;
  createdAt: Date;
  translations: BrandTranslationRow[];
  _count: { products: number };
};

/** Sort hint - pick the default-locale name when available, else first row. */
function defaultName(translations: readonly BrandTranslationRow[]): string {
  return (
    translations.find((t) => t.locale === DEFAULT_LOCALE)?.name ??
    translations[0]?.name ??
    ""
  );
}

export async function getAllBrands(): Promise<BrandListItem[]> {
  const rows = await prisma.brand.findMany({
    include: {
      translations: true,
      _count: {
        select: {
          products: { where: { deletedAt: null } },
        },
      },
    },
  });
  return rows
    .map((r) => ({
      id: r.id,
      logoUrl: r.logoUrl,
      createdAt: r.createdAt,
      translations: r.translations,
      _count: r._count,
    }))
    .sort((a, b) => defaultName(a.translations).localeCompare(defaultName(b.translations)));
}

export async function getBrandById(id: string) {
  return prisma.brand.findUnique({
    where: { id },
    include: { translations: true },
  });
}

type BrandMutationData = {
  name: string;
  slug?: string;
  logoUrl?: string | null;
  description?: string | null;
  translations?: BrandTranslations | null;
};

/**
 * Builds the per-locale translation rows for a Brand from the legacy form
 * shape ({ name, slug, description, translations: { [locale]: { name, description } } }).
 * The default locale is always written from the top-level canonical fields;
 * non-default locales come from the `translations` map. Locales without a
 * translated name are skipped so we never insert an empty-name row.
 */
function buildBrandTranslationRows(data: BrandMutationData): BrandTranslationRow[] {
  const defaultSlug = (data.slug?.trim() || slugify(data.name)).trim();
  const rows: BrandTranslationRow[] = [
    {
      locale: DEFAULT_LOCALE,
      name: data.name.trim(),
      slug: defaultSlug,
      description: data.description?.trim() || null,
    },
  ];

  for (const locale of NON_DEFAULT_LOCALES) {
    const t = data.translations?.[locale];
    const name = t?.name?.trim();
    if (!name) continue;
    // Prefer the admin-supplied per-locale slug; fall back to slugify-of-name,
    // then to a deterministic `${defaultSlug}-${locale}` to guarantee a row.
    const explicitSlug = t?.slug?.trim();
    rows.push({
      locale,
      name,
      slug: explicitSlug || slugify(name) || `${defaultSlug}-${locale}`,
      description: t?.description?.trim() || null,
    });
  }
  return rows;
}

export async function createBrand(data: BrandMutationData) {
  const rows = buildBrandTranslationRows(data);

  const brand = await prisma.$transaction(async (tx) => {
    const created = await tx.brand.create({
      data: {
        logoUrl: data.logoUrl ?? null,
        translations: { create: rows },
      },
      include: { translations: true },
    });
    // Reclaim these slugs from history so a live brand URL never 308s away.
    await recordSlugChanges(
      tx,
      "BRAND",
      created.id,
      new Map(),
      new Map(rows.map((r) => [r.locale, r.slug])),
    );
    return created;
  });

  revalidateBrandCache(brand.id);
  return brand;
}

export async function updateBrand(id: string, data: BrandMutationData) {
  const existing = await prisma.brand.findUnique({
    where: { id },
    include: { translations: true },
  });
  if (!existing) throw new NotFoundError(`Brand ${id} not found`);

  const rows = buildBrandTranslationRows(data);

  // Detect whether anything that contributes to ProductTranslation.searchText
  // (the brand name in any locale) actually changed. Skip the per-product
  // refresh fan-out when only the logo or description moved.
  const oldByLocale = new Map(existing.translations.map((t) => [t.locale, t.name]));
  const searchableChanged = rows.some((r) => oldByLocale.get(r.locale) !== r.name);

  const brand = await prisma.$transaction(async (tx) => {
    await tx.brand.update({
      where: { id },
      data: { logoUrl: data.logoUrl ?? null },
    });

    // Replace-all strategy on translations: simpler than per-locale diff and
    // brand rows are tiny (≤ N locales). FK cascades clean up.
    await tx.brandTranslation.deleteMany({ where: { brandId: id } });
    await tx.brandTranslation.createMany({
      data: rows.map((r) => ({ ...r, brandId: id })),
    });

    await recordSlugChanges(
      tx,
      "BRAND",
      id,
      new Map(existing.translations.map((t) => [t.locale, t.slug])),
      new Map(rows.map((r) => [r.locale, r.slug])),
    );

    return tx.brand.findUniqueOrThrow({
      where: { id },
      include: { translations: true },
    });
  });

  if (searchableChanged) {
    const products = await prisma.product.findMany({
      where: { brandId: id, deletedAt: null },
      select: { id: true },
    });
    for (const p of products) {
      await refreshProductSearchText(prisma as unknown as Prisma.TransactionClient, p.id);
    }
  }

  revalidateBrandCache(brand.id);
  return brand;
}

export async function deleteBrand(id: string) {
  const existing = await prisma.brand.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError(`Brand ${id} not found`);

  await prisma.brand.delete({ where: { id } });
  revalidateBrandCache(id);
}

export async function duplicateBrand(id: string) {
  const source = await prisma.brand.findUnique({
    where: { id },
    include: { translations: true },
  });
  if (!source) throw new NotFoundError(`Brand ${id} not found`);

  // Suffix every slug so the copy can never collide with the source on the
  // unique BrandTranslation.slug constraint; prefix only the default-locale
  // name with "Copy of" to mirror the product-duplicate convention.
  const suffix = Date.now().toString(36);
  const rows: BrandTranslationRow[] = source.translations.map((t) => ({
    locale: t.locale,
    name: t.locale === DEFAULT_LOCALE ? `Copy of ${t.name}` : t.name,
    slug: `${t.slug}-copy-${suffix}`,
    description: t.description,
  }));

  const brand = await prisma.$transaction(async (tx) => {
    const created = await tx.brand.create({
      data: {
        logoUrl: source.logoUrl,
        translations: { create: rows },
      },
      include: { translations: true },
    });
    // Reclaim the copy's slugs from history so its URL never 308s away.
    await recordSlugChanges(
      tx,
      "BRAND",
      created.id,
      new Map(),
      new Map(rows.map((r) => [r.locale, r.slug])),
    );
    return created;
  });

  revalidateBrandCache(brand.id);
  return brand;
}
