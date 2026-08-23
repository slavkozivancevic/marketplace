import { prisma, type TransactionClient } from "@/core/db/prisma";
import { SluggedEntityType } from "@/generated/prisma/client";
import { DEFAULT_LOCALE } from "@/i18n/config";

/**
 * Slug-history helpers. When an entity's per-locale slug is renamed we keep the
 * old slug here so the proxy can 308 a stale URL to the entity's current slug -
 * preserving inbound links and transferring SEO value instead of hard-404ing.
 *
 * Reclaim rule: a slug that is currently active must never live in history (it
 * would redirect a live URL onto itself or elsewhere), so every write prunes
 * history rows matching the now-active slugs.
 */

/**
 * Records retired slugs and reclaims active ones for a single entity. Call from
 * inside the same transaction that rewrites the entity's translation rows, with
 * the slugs as they were BEFORE the write (`oldSlugsByLocale`) and after
 * (`newSlugsByLocale`). On create, pass an empty `oldSlugsByLocale`.
 */
export async function recordSlugChanges(
  tx: TransactionClient,
  entityType: SluggedEntityType,
  entityId: string,
  oldSlugsByLocale: Map<string, string>,
  newSlugsByLocale: Map<string, string>,
): Promise<void> {
  // Retire slugs that actually changed for a locale.
  for (const [locale, oldSlug] of oldSlugsByLocale) {
    if (!oldSlug) continue;
    if (oldSlug === newSlugsByLocale.get(locale)) continue;
    await tx.slugHistory.upsert({
      where: { entityType_locale_slug: { entityType, locale, slug: oldSlug } },
      // Re-point an old slug to this entity if some other (since-deleted)
      // entity had retired the same slug; refresh the timestamp either way.
      create: { entityType, entityId, locale, slug: oldSlug },
      update: { entityId, createdAt: new Date() },
    });
  }

  // Reclaim: drop any history row whose slug is now active again, so a live URL
  // never redirects.
  for (const [locale, newSlug] of newSlugsByLocale) {
    if (!newSlug) continue;
    await tx.slugHistory.deleteMany({
      where: { entityType, locale, slug: newSlug },
    });
  }
}

/**
 * Drops all history for an entity. Call when the entity is hard-deleted so its
 * retired slugs stop resolving (a deleted product should 404, not redirect).
 */
export async function clearSlugHistory(
  tx: TransactionClient,
  entityType: SluggedEntityType,
  entityId: string,
): Promise<void> {
  await tx.slugHistory.deleteMany({ where: { entityType, entityId } });
}

/**
 * Resolves a retired slug to the entity's CURRENT slug in the requested locale,
 * or null when the slug isn't in history or the entity is gone/unpublished
 * (caller should then 404). Looks up the slug in the requested locale first,
 * then in any locale (mirroring the locale-agnostic page lookup).
 */
export async function resolveRetiredSlug(
  entityType: SluggedEntityType,
  locale: string,
  slug: string,
): Promise<string | null> {
  const hit =
    (await prisma.slugHistory.findUnique({
      where: { entityType_locale_slug: { entityType, locale, slug } },
      select: { entityId: true },
    })) ??
    (await prisma.slugHistory.findFirst({
      where: { entityType, slug },
      select: { entityId: true },
    }));
  if (!hit) return null;
  return currentSlugFor(entityType, hit.entityId, locale);
}

function pickSlug(
  rows: { locale: string; slug: string }[],
  locale: string,
): string | null {
  return (
    rows.find((r) => r.locale === locale)?.slug ??
    rows.find((r) => r.locale === DEFAULT_LOCALE)?.slug ??
    rows[0]?.slug ??
    null
  );
}

/**
 * Current slug of an entity in `locale` (falling back to the default locale,
 * then any locale). Mirrors the proxy's existence checks: a product must still
 * be published and not soft-deleted, otherwise we return null so the retired
 * URL 404s instead of redirecting to a dead page.
 */
async function currentSlugFor(
  entityType: SluggedEntityType,
  entityId: string,
  locale: string,
): Promise<string | null> {
  if (entityType === "PRODUCT") {
    const product = await prisma.product.findFirst({
      where: { id: entityId, status: "PUBLISHED", deletedAt: null },
      select: { translations: { select: { locale: true, slug: true } } },
    });
    return product ? pickSlug(product.translations, locale) : null;
  }
  if (entityType === "CATEGORY") {
    const rows = await prisma.categoryTranslation.findMany({
      where: { categoryId: entityId },
      select: { locale: true, slug: true },
    });
    return pickSlug(rows, locale);
  }
  if (entityType === "TAG") {
    const rows = await prisma.tagTranslation.findMany({
      where: { tagId: entityId },
      select: { locale: true, slug: true },
    });
    return pickSlug(rows, locale);
  }
  const rows = await prisma.brandTranslation.findMany({
    where: { brandId: entityId },
    select: { locale: true, slug: true },
  });
  return pickSlug(rows, locale);
}
