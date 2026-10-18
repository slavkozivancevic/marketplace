import { prisma } from "@/core/db/prisma";
import { NotFoundError } from "@/features/common/errors/domainErrors";
import { DEFAULT_LOCALE, NON_DEFAULT_LOCALES } from "@/i18n/config";
import { revalidateTrustPointCache } from "./cache";
import { copyName } from "@/lib/i18n/copyName";
import { TRUST_POINT_LABEL_MAX_LENGTH } from "../schema/trustPoints";
import type { TrustPointTranslationRow } from "../utils/translations";

export type { TrustPointTranslationRow } from "../utils/translations";
export { getTrustPointLabel, getTrustPointSublabel } from "../utils/translations";

export type TrustPointListItem = {
  id: string;
  icon: string;
  order: number;
  isActive: boolean;
  createdAt: Date;
  translations: TrustPointTranslationRow[];
};

/** Admin list: every point, in the order the strip would render them. */
export async function getAllTrustPoints(): Promise<TrustPointListItem[]> {
  return prisma.trustPoint.findMany({
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      icon: true,
      order: true,
      isActive: true,
      createdAt: true,
      translations: { select: { locale: true, label: true, sublabel: true } },
    },
  });
}

/**
 * The storefront strip: active points only, in display order.
 *
 * Returns the translation rows rather than one locale's strings - the caller
 * caches this, and a cached payload must not be tied to the language of
 * whoever happened to warm it.
 */
export async function getActiveTrustPoints(): Promise<TrustPointListItem[]> {
  return prisma.trustPoint.findMany({
    where: { isActive: true },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      icon: true,
      order: true,
      isActive: true,
      createdAt: true,
      translations: { select: { locale: true, label: true, sublabel: true } },
    },
  });
}

export async function getTrustPointById(id: string) {
  return prisma.trustPoint.findUnique({
    where: { id },
    include: { translations: true },
  });
}

type TrustPointMutationData = {
  label: string;
  sublabel?: string;
  icon: string;
  order: number;
  isActive: boolean;
  translations?: Record<
    string,
    { label?: string; sublabel?: string } | undefined
  > | null;
};

/**
 * Per-locale rows from the form shape.
 *
 * The default locale always gets a row, from the canonical fields. A
 * non-default locale is written only when it has a label: a row with an empty
 * label would win the lookup over the default-locale fallback and render the
 * strip entry as a bare icon.
 */
function buildTranslationRows(
  data: TrustPointMutationData,
): TrustPointTranslationRow[] {
  const rows: TrustPointTranslationRow[] = [
    {
      locale: DEFAULT_LOCALE,
      label: data.label.trim(),
      sublabel: data.sublabel?.trim() || null,
    },
  ];

  for (const locale of NON_DEFAULT_LOCALES) {
    const t = data.translations?.[locale];
    const label = t?.label?.trim();
    if (!label) continue;
    rows.push({ locale, label, sublabel: t?.sublabel?.trim() || null });
  }
  return rows;
}

/** The default locale's label, for audit lines and toasts: a UUID tells the
 *  reader nothing, and the viewer's locale is not knowable from the server. */
function labelOf(translations: { locale: string; label: string }[]): string {
  return (
    translations.find((t) => t.locale === DEFAULT_LOCALE)?.label ??
    translations[0]?.label ??
    ""
  );
}

export async function createTrustPoint(data: TrustPointMutationData) {
  const created = await prisma.trustPoint.create({
    data: {
      icon: data.icon,
      order: data.order,
      isActive: data.isActive,
      translations: { create: buildTranslationRows(data) },
    },
    include: { translations: true },
  });

  revalidateTrustPointCache(created.id);
  return created;
}

export async function updateTrustPoint(id: string, data: TrustPointMutationData) {
  const existing = await prisma.trustPoint.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!existing) throw new NotFoundError(`TrustPoint ${id} not found`);

  const rows = buildTranslationRows(data);

  const updated = await prisma.$transaction(async (tx) => {
    // Replace-all on translations, like tags: at most one row per locale and
    // the rows are tiny, so a per-locale diff would buy nothing. It also
    // removes a locale the admin has emptied, which a diff would have to
    // handle as its own case.
    await tx.trustPointTranslation.deleteMany({ where: { trustPointId: id } });
    await tx.trustPointTranslation.createMany({
      data: rows.map((r) => ({ ...r, trustPointId: id })),
    });
    return tx.trustPoint.update({
      where: { id },
      data: { icon: data.icon, order: data.order, isActive: data.isActive },
      include: { translations: true },
    });
  });

  revalidateTrustPointCache(id);
  return updated;
}

/**
 * Returns the deleted point's default-locale label, for the audit trail.
 *
 * No `assertNotInUse`: nothing references a trust point. It is a label on a
 * marketing strip, the same reasoning that leaves tag deletion unguarded -
 * unlike categories, attributes and brands, which are structure.
 */
export async function deleteTrustPoint(id: string): Promise<string> {
  const existing = await prisma.trustPoint.findUnique({
    where: { id },
    select: { translations: { select: { locale: true, label: true, sublabel: true } } },
  });
  if (!existing) throw new NotFoundError(`TrustPoint ${id} not found`);

  await prisma.trustPoint.delete({ where: { id } });
  revalidateTrustPointCache(id);

  return labelOf(existing.translations);
}

/**
 * A copy of a trust point, hidden until an admin says otherwise.
 *
 * The copy starts INACTIVE, for the same reason `duplicateCategory` forces
 * `isFeatured: false`: this strip is live on the storefront, and a half-edited
 * duplicate must not appear beside its original the moment it is created.
 *
 * Every locale's label gets its own "Copy of" prefix - the admin list shows the
 * viewer's locale, so prefixing only the default one would leave the Serbian
 * list with two rows reading exactly the same. There is no slug to suffix here:
 * a trust point has no URL.
 */
export async function duplicateTrustPoint(id: string) {
  const source = await prisma.trustPoint.findUnique({
    where: { id },
    include: { translations: true },
  });
  if (!source) throw new NotFoundError(`TrustPoint ${id} not found`);

  const created = await prisma.trustPoint.create({
    data: {
      icon: source.icon,
      order: source.order,
      isActive: false,
      translations: {
        create: source.translations.map((t) => ({
          locale: t.locale,
          label: copyName(t.locale, t.label, TRUST_POINT_LABEL_MAX_LENGTH),
          sublabel: t.sublabel,
        })),
      },
    },
    include: { translations: true },
  });

  revalidateTrustPointCache(created.id);
  return { ...created, sourceLabel: labelOf(source.translations) };
}
