import { prisma } from "@/core/db/prisma";
import { NotFoundError } from "@/features/common/errors/domainErrors";
import { slugify } from "@/lib/utils";
import { DEFAULT_LOCALE, NON_DEFAULT_LOCALES } from "@/i18n/config";
import type { AttributeType } from "@/generated/prisma/client";
import { revalidateAttributeCache } from "./cache";
import { OPTION_TYPES, type AttributeInput } from "../schema/attributes";

export { getAttributeLabel } from "../utils/translations";

// ---------- Read types ----------

type LabelRow = { locale: string; label: string };

export type AttributeOptionItem = {
  id: string;
  value: string;
  order: number;
  translations: LabelRow[];
};

export type AttributeListItem = {
  id: string;
  key: string;
  type: AttributeType;
  unit: string | null;
  order: number;
  translations: LabelRow[];
  _count: { options: number; categories: number; values: number };
};

export type AttributeDetail = {
  id: string;
  key: string;
  type: AttributeType;
  unit: string | null;
  order: number;
  translations: LabelRow[];
  options: AttributeOptionItem[];
};

// ---------- Queries ----------

export async function getAllAttributes(): Promise<AttributeListItem[]> {
  return prisma.attribute.findMany({
    orderBy: [{ order: "asc" }, { key: "asc" }],
    select: {
      id: true,
      key: true,
      type: true,
      unit: true,
      order: true,
      translations: { select: { locale: true, label: true } },
      _count: { select: { options: true, categories: true, values: true } },
    },
  });
}

export async function getAttributeById(
  id: string,
): Promise<AttributeDetail | null> {
  return prisma.attribute.findUnique({
    where: { id },
    select: {
      id: true,
      key: true,
      type: true,
      unit: true,
      order: true,
      translations: { select: { locale: true, label: true } },
      options: {
        orderBy: { order: "asc" },
        select: {
          id: true,
          value: true,
          order: true,
          translations: { select: { locale: true, label: true } },
        },
      },
    },
  });
}

export type AttributeLibraryItem = {
  id: string;
  type: AttributeType;
  unit: string | null;
  translations: LabelRow[];
};

/**
 * Minimal attribute list (no options) for the category assignment picker.
 * Ordered the same way the facet sidebar renders.
 */
export async function getAttributeLibrary(): Promise<AttributeLibraryItem[]> {
  return prisma.attribute.findMany({
    orderBy: [{ order: "asc" }, { key: "asc" }],
    select: {
      id: true,
      type: true,
      unit: true,
      translations: { select: { locale: true, label: true } },
    },
  });
}

export type AttributeSelectorItem = {
  id: string;
  key: string;
  type: AttributeType;
  unit: string | null;
  isVariantDefining: boolean;
  translations: LabelRow[];
  options: { id: string; value: string; translations: LabelRow[] }[];
};

/** Attributes with their options - used by the product form value inputs. */
export async function getAttributesForSelector(): Promise<AttributeSelectorItem[]> {
  return prisma.attribute.findMany({
    orderBy: [{ order: "asc" }, { key: "asc" }],
    select: {
      id: true,
      key: true,
      type: true,
      unit: true,
      isVariantDefining: true,
      translations: { select: { locale: true, label: true } },
      options: {
        orderBy: { order: "asc" },
        select: {
          id: true,
          value: true,
          translations: { select: { locale: true, label: true } },
        },
      },
    },
  });
}

// ---------- Mutation helpers ----------

/** Builds per-locale label rows (default locale + any filled non-default). */
function buildLabelRows(
  defaultLabel: string,
  translations: AttributeInput["translations"],
): LabelRow[] {
  const rows: LabelRow[] = [
    { locale: DEFAULT_LOCALE, label: defaultLabel.trim() },
  ];
  for (const locale of NON_DEFAULT_LOCALES) {
    const label = translations?.[locale]?.label?.trim();
    if (label) rows.push({ locale, label });
  }
  return rows;
}

function isOptionType(type: AttributeType): boolean {
  return OPTION_TYPES.includes(type as (typeof OPTION_TYPES)[number]);
}

// ---------- Mutations ----------

export async function createAttribute(data: AttributeInput) {
  const key = (data.key?.trim() || slugify(data.label)).trim();
  const unit = data.type === "RANGE" ? data.unit?.trim() || null : null;
  const attrRows = buildLabelRows(data.label, data.translations);

  const created = await prisma.$transaction(async (tx) => {
    const attribute = await tx.attribute.create({
      data: {
        key,
        type: data.type,
        unit,
        order: data.order ?? 0,
        translations: { create: attrRows },
      },
    });

    if (isOptionType(data.type)) {
      for (const [index, opt] of data.options.entries()) {
        const value = (opt.value?.trim() || slugify(opt.label)).trim();
        await tx.attributeOption.create({
          data: {
            attributeId: attribute.id,
            value,
            order: opt.order ?? index,
            translations: { create: buildLabelRows(opt.label, opt.translations) },
          },
        });
      }
    }

    return attribute;
  });

  revalidateAttributeCache(created.id);
  return created;
}

export async function updateAttribute(id: string, data: AttributeInput) {
  const existing = await prisma.attribute.findUnique({
    where: { id },
    select: { id: true, options: { select: { id: true } } },
  });
  if (!existing) throw new NotFoundError(`Attribute ${id} not found`);

  const key = (data.key?.trim() || slugify(data.label)).trim();
  const unit = data.type === "RANGE" ? data.unit?.trim() || null : null;
  const attrRows = buildLabelRows(data.label, data.translations);

  await prisma.$transaction(async (tx) => {
    await tx.attribute.update({
      where: { id },
      data: { key, type: data.type, unit, order: data.order ?? 0 },
    });

    // Replace attribute label translations wholesale (cheap, no FK fan-out).
    await tx.attributeTranslation.deleteMany({ where: { attributeId: id } });
    await tx.attributeTranslation.createMany({
      data: attrRows.map((r) => ({ ...r, attributeId: id })),
    });

    if (isOptionType(data.type)) {
      // Sync options by id so existing ProductAttributeValue rows (FK ->
      // optionId) survive an edit. Only options the admin removed are deleted
      // (which cascades their product values, as intended).
      const submittedIds = new Set(
        data.options.map((o) => o.id).filter(Boolean) as string[],
      );
      const toDelete = existing.options
        .map((o) => o.id)
        .filter((existingId) => !submittedIds.has(existingId));
      if (toDelete.length) {
        await tx.attributeOption.deleteMany({ where: { id: { in: toDelete } } });
      }

      for (const [index, opt] of data.options.entries()) {
        const value = (opt.value?.trim() || slugify(opt.label)).trim();
        const optionRows = buildLabelRows(opt.label, opt.translations);
        if (opt.id && submittedIds.has(opt.id)) {
          await tx.attributeOption.update({
            where: { id: opt.id },
            data: { value, order: opt.order ?? index },
          });
          await tx.attributeOptionTranslation.deleteMany({
            where: { optionId: opt.id },
          });
          await tx.attributeOptionTranslation.createMany({
            data: optionRows.map((r) => ({ ...r, optionId: opt.id! })),
          });
        } else {
          await tx.attributeOption.create({
            data: {
              attributeId: id,
              value,
              order: opt.order ?? index,
              translations: { create: optionRows },
            },
          });
        }
      }
    } else {
      // Switched away from an option-based type: drop any stale options.
      await tx.attributeOption.deleteMany({ where: { attributeId: id } });
    }
  });

  revalidateAttributeCache(id);
}

export async function deleteAttribute(id: string) {
  const existing = await prisma.attribute.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError(`Attribute ${id} not found`);
  await prisma.attribute.delete({ where: { id } });
  revalidateAttributeCache(id);
}

export async function duplicateAttribute(id: string) {
  const source = await prisma.attribute.findUnique({
    where: { id },
    select: {
      key: true,
      type: true,
      unit: true,
      order: true,
      translations: { select: { locale: true, label: true } },
      options: {
        orderBy: { order: "asc" },
        select: {
          value: true,
          order: true,
          translations: { select: { locale: true, label: true } },
        },
      },
    },
  });
  if (!source) throw new NotFoundError(`Attribute ${id} not found`);

  // Suffix the key so the copy can never collide on the unique constraint;
  // prefix only the default-locale label with "Copy of" (mirrors the
  // product/category duplicate convention).
  const suffix = Date.now().toString(36);
  const labelRows = source.translations.map((tr) => ({
    locale: tr.locale,
    label: tr.locale === DEFAULT_LOCALE ? `Copy of ${tr.label}` : tr.label,
  }));

  const created = await prisma.attribute.create({
    data: {
      key: `${source.key}-copy-${suffix}`,
      type: source.type,
      unit: source.unit,
      order: source.order,
      translations: { create: labelRows },
      options: {
        create: source.options.map((opt) => ({
          value: opt.value,
          order: opt.order,
          translations: {
            create: opt.translations.map((tr) => ({
              locale: tr.locale,
              label: tr.label,
            })),
          },
        })),
      },
    },
  });

  revalidateAttributeCache(created.id);
  return created;
}
