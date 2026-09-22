import { prisma } from "@/core/db/prisma";
import { NotFoundError } from "@/features/common/errors/domainErrors";
import { revalidateTagCache, revalidateTagProductCaches } from "./cache";
import { slugify } from "@/lib/utils";
import { copyName } from "@/lib/i18n/copyName";
import { copyIdentifier } from "@/lib/copyIdentifier";
import { TAG_NAME_MAX_LENGTH, TAG_SLUG_MAX_LENGTH } from "../schema/tags";
import { refreshProductSearchText } from "@/features/products/db/products";
import { recordSlugChanges } from "@/lib/seo/slugHistory";
import { createWithUniqueSlugRetry } from "@/lib/db/uniqueSlugRetry";
import { DEFAULT_LOCALE, NON_DEFAULT_LOCALES } from "@/i18n/config";
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
function buildTagTranslationRows(
  data: TagMutationData,
  suffix?: string,
): TagTranslationRow[] {
  const defaultSlug = (
    (data.slug?.trim() || slugify(data.name)) + (suffix ? `-${suffix}` : "")
  ).trim();
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
    // The uniqueness suffix has to reach EVERY locale, not just the default
    // one: `@@unique([locale, slug])` is enforced per row, so a retry that only
    // suffixed the default row still collided on the translated ones.
    const derivedSlug = explicitSlug || slugify(name);
    rows.push({
      locale,
      name,
      slug: derivedSlug
        ? derivedSlug + (suffix ? `-${suffix}` : "")
        : `${defaultSlug}-${locale}`,
    });
  }
  return rows;
}

export async function createTag(data: TagMutationData) {
  const tag = await createWithUniqueSlugRetry(async (suffix) => {
    const rows = buildTagTranslationRows(data, suffix);

    return prisma.$transaction(async (tx) => {
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
      await refreshProductSearchText(prisma, p.id);
    }
    revalidateTagProductCaches(products);
  }

  revalidateTagCache(tag.id);
  return tag;
}

/**
 * Returns the deleted tag's default-locale name, for the audit trail.
 *
 * No `assertNotInUse` here, deliberately: a tag is a label, and ProductTag
 * cascading away takes nothing with it that was not already visible on the tag
 * itself. Categories, attributes and brands are structure - see the guards there.
 */
export async function deleteTag(id: string): Promise<string> {
  const existing = await prisma.tag.findUnique({
    where: { id },
    select: { translations: { select: { locale: true, name: true } } },
  });
  if (!existing) throw new NotFoundError(`Tag ${id} not found`);

  await prisma.tag.delete({ where: { id } });
  revalidateTagCache(id);
  return sourceLabelOf(existing.translations);
}

/** The source's default-locale name, for the audit trail's "Copied from". */
function sourceLabelOf(
  translations: readonly { locale: string; name: string }[],
): string {
  return translations.find((t) => t.locale === DEFAULT_LOCALE)?.name ?? "";
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
  const now = Date.now();
  const rows: TagTranslationRow[] = source.translations.map((t) => ({
    locale: t.locale,
    name: copyName(t.locale, t.name, TAG_NAME_MAX_LENGTH),
    slug: copyIdentifier(t.slug, TAG_SLUG_MAX_LENGTH, now),
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
  // `sourceLabel` is the source's default-locale name: the audit trail then
  // reads "Copied from: Novo" instead of a UUID no reader can resolve.
  return { ...tag, sourceLabel: sourceLabelOf(source.translations) };
}
