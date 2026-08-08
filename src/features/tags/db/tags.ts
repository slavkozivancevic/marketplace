import { prisma } from "@/core/db/prisma";
import { NotFoundError } from "@/features/common/errors/domainErrors";
import { revalidateTagCache, revalidateTagProductCaches } from "./cache";
import { slugify } from "@/lib/utils";
import { copyName } from "@/lib/i18n/copyName";
import { refreshProductSearchText } from "@/features/products/db/products";
import { recordSlugChanges } from "@/lib/seo/slugHistory";
import { DEFAULT_LOCALE, NON_DEFAULT_LOCALES } from "@/i18n/config";
import { Prisma } from "@/generated/prisma/client";
import type { TagTranslations } from "../utils/translations";

export type { TagTranslations } from "../utils/translations";
export { getTagName, getTagSlug } from "../utils/translations";

type TagTranslationRow = {
  locale: string;
  name: string;
  slug: string;
};

export type TagListItem = {
  id: string;
  createdAt: Date;
  translations: TagTranslationRow[];
  _count: { products: number };
};

/** Sort hint - pick the default-locale name when available, else first row. */
function defaultName(translations: readonly TagTranslationRow[]): string {
  return (
    translations.find((t) => t.locale === DEFAULT_LOCALE)?.name ??
    translations[0]?.name ??
    ""
  );
}

export async function getAllTags(): Promise<TagListItem[]> {
  const rows = await prisma.tag.findMany({
    include: {
      translations: true,
      _count: { select: { products: true } },
    },
  });
  return rows
    .map((r) => ({
      id: r.id,
      createdAt: r.createdAt,
      translations: r.translations,
      _count: r._count,
    }))
    .sort((a, b) => defaultName(a.translations).localeCompare(defaultName(b.translations)));
}

export async function getTagById(id: string) {
  return prisma.tag.findUnique({
    where: { id },
    include: { translations: true },
  });
}

type TagMutationData = {
  name: string;
  slug?: string;
  translations?: TagTranslations | null;
};

/**
 * Builds the per-locale translation rows for a Tag from the legacy form
 * shape ({ name, slug, translations: { [locale]: { name, slug } } }).
 * The default locale is always written from the top-level canonical fields;
 * non-default locales come from the `translations` map. Locales without a
 * translated name are skipped so we never insert an empty-name row.
 */
function buildTagTranslationRows(data: TagMutationData): TagTranslationRow[] {
  const defaultSlug = (data.slug?.trim() || slugify(data.name)).trim();
  const rows: TagTranslationRow[] = [
    { locale: DEFAULT_LOCALE, name: data.name.trim(), slug: defaultSlug },
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
    });
  }
  return rows;
}

export async function createTag(data: TagMutationData) {
  const rows = buildTagTranslationRows(data);

  const tag = await prisma.$transaction(async (tx) => {
    const created = await tx.tag.create({
      data: { translations: { create: rows } },
      include: { translations: true },
    });
    // Reclaim these slugs from history so a live tag URL never 308s away.
    await recordSlugChanges(
      tx,
      "TAG",
      created.id,
      new Map(),
      new Map(rows.map((r) => [r.locale, r.slug])),
    );
    return created;
  });

  revalidateTagCache(tag.id);
  return tag;
}

export async function updateTag(id: string, data: TagMutationData) {
  const existing = await prisma.tag.findUnique({
    where: { id },
    include: { translations: true },
  });
  if (!existing) throw new NotFoundError(`Tag ${id} not found`);

  const rows = buildTagTranslationRows(data);

  // Detect whether any locale's name actually changed - only then fan out the
  // per-product searchText refresh (tag names feed ProductTranslation.searchText).
  const oldByLocale = new Map(existing.translations.map((t) => [t.locale, t.name]));
  const searchableChanged = rows.some((r) => oldByLocale.get(r.locale) !== r.name);

  const tag = await prisma.$transaction(async (tx) => {
    // Replace-all strategy on translations: simpler than per-locale diff and
    // tag rows are tiny (<= N locales). FK cascades clean up.
    await tx.tagTranslation.deleteMany({ where: { tagId: id } });
    await tx.tagTranslation.createMany({
      data: rows.map((r) => ({ ...r, tagId: id })),
    });

    await recordSlugChanges(
      tx,
      "TAG",
      id,
      new Map(existing.translations.map((t) => [t.locale, t.slug])),
      new Map(rows.map((r) => [r.locale, r.slug])),
    );

    return tx.tag.findUniqueOrThrow({
      where: { id },
      include: { translations: true },
    });
  });

  if (searchableChanged) {
    const products = await prisma.product.findMany({
      where: { tags: { some: { tagId: id } }, deletedAt: null },
      select: { id: true, organizationId: true },
    });
    for (const p of products) {
      await refreshProductSearchText(prisma as unknown as Prisma.TransactionClient, p.id);
    }
    revalidateTagProductCaches(products);
  }

  revalidateTagCache(tag.id);
  return tag;
}

export async function deleteTag(id: string) {
  const existing = await prisma.tag.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError(`Tag ${id} not found`);

  await prisma.tag.delete({ where: { id } });
  revalidateTagCache(id);
}

export async function duplicateTag(id: string) {
  const source = await prisma.tag.findUnique({
    where: { id },
    include: { translations: true },
  });
  if (!source) throw new NotFoundError(`Tag ${id} not found`);

  // Suffix every slug so the copy can never collide with the source on the
  // unique TagTranslation.slug constraint. Prefix EVERY locale's name with its
  // localized "Copy of" (copyName) - the admin list displays the
  // viewer-locale name, so a prefix only on the default locale would leave
  // e.g. the sr list showing a row identical to the source.
  const suffix = Date.now().toString(36);
  const rows: TagTranslationRow[] = source.translations.map((t) => ({
    locale: t.locale,
    name: copyName(t.locale, t.name),
    slug: `${t.slug}-copy-${suffix}`,
  }));

  const tag = await prisma.$transaction(async (tx) => {
    const created = await tx.tag.create({
      data: { translations: { create: rows } },
      include: { translations: true },
    });
    await recordSlugChanges(
      tx,
      "TAG",
      created.id,
      new Map(),
      new Map(rows.map((r) => [r.locale, r.slug])),
    );
    return created;
  });

  revalidateTagCache(tag.id);
  return tag;
}
