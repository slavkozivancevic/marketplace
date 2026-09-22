import { prisma } from "@/core/db/prisma";
import { NotFoundError } from "@/features/common/errors/domainErrors";
import { assertNotInUse } from "@/features/common/db/assertNotInUse";
import { slugify } from "@/lib/utils";
import { DEFAULT_LOCALE, NON_DEFAULT_LOCALES } from "@/i18n/config";
import type { AttributeType } from "@/generated/prisma/client";
import { revalidateAttributeCache } from "./cache";
import { createWithUniqueSlugRetry } from "@/lib/db/uniqueSlugRetry";
import {
  ATTRIBUTE_KEY_MAX_LENGTH,
  ATTRIBUTE_LABEL_MAX_LENGTH,
  OPTION_TYPES,
  type AttributeInput,
} from "../schema/attributes";
import { copyIdentifier } from "@/lib/copyIdentifier";
import { copyName } from "@/lib/i18n/copyName";

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
  // `variantValues` rides along so the admin list can block a delete on exactly
  // what deleteAttribute() blocks on - values on products AND on variant axes.
  _count: { options: number; categories: number; values: number; variantValues: number };
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
      _count: { select: { options: true, categories: true, values: true, variantValues: true } },
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
  const unit = data.type === "RANGE" ? data.unit?.trim() || null : null;
  const attrRows = buildLabelRows(data.label, data.translations);

  const created = await createWithUniqueSlugRetry(async (suffix) => {
    const key = (
      (data.key?.trim() || slugify(data.label)) + (suffix ? `-${suffix}` : "")
    ).trim();

    return prisma.$transaction(async (tx) => {
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

/** Returns the deleted attribute's key, for the audit trail. */
export async function deleteAttribute(id: string): Promise<string> {
  const existing = await prisma.attribute.findUnique({
    where: { id },
    select: { key: true, _count: { select: { values: true, variantValues: true } } },
  });
  if (!existing) throw new NotFoundError(`Attribute ${id} not found`);

  // Values entered on products (and on variant axes) cascade away with the
  // attribute and cannot be reconstructed. Category assignments deliberately do
  // NOT block: those are configuration, they cost nothing to redo, and blocking
  // on them would make a mis-assigned attribute undeletable.
  assertNotInUse([
    {
      count: existing._count.values + existing._count.variantValues,
      key: "attributeInUse",
    },
  ]);

  await prisma.attribute.delete({ where: { id } });
  revalidateAttributeCache(id);
  return existing.key;
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

  // Suffix the key so the copy can never collide on the unique constraint, and
  // prefix EVERY locale's label with its localized "Copy of" (copyName) - the
  // admin list displays the viewer-locale label, so the old English prefix on
  // the default locale alone left e.g. the sr list showing a row identical to
  // the source. Now matches the brand/category/tag duplicate convention.
  const labelRows = source.translations.map((tr) => ({
    locale: tr.locale,
    label: copyName(tr.locale, tr.label, ATTRIBUTE_LABEL_MAX_LENGTH),
  }));

  const created = await prisma.attribute.create({
    data: {
      key: copyIdentifier(source.key, ATTRIBUTE_KEY_MAX_LENGTH),
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
  // `sourceLabel` is the source's default-locale label: the audit trail then
  // reads "Copied from: Size" instead of a UUID no reader can resolve.
  return {
    ...created,
    sourceLabel:
      source.translations.find((t) => t.locale === DEFAULT_LOCALE)?.label ?? "",
  };
}
