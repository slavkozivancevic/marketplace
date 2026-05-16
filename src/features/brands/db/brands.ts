import { prisma } from "@/core/db/prisma";
import { NotFoundError } from "@/features/common/errors/domainErrors";
import { revalidateBrandCache } from "./cache";
import { slugify } from "@/lib/utils";
import { refreshProductSearchText } from "@/features/products/db/products";
import type { BrandTranslations } from "../utils/translations";

export type { BrandTranslations } from "../utils/translations";
export { getBrandName, getBrandDescription } from "../utils/translations";

export type BrandListItem = {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  description: string | null;
  createdAt: Date;
  _count: { products: number };
};

export async function getAllBrands(): Promise<BrandListItem[]> {
  return prisma.brand.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { products: true } } },
  });
}

export async function getBrandById(id: string) {
  return prisma.brand.findUnique({ where: { id } });
}

export async function createBrand(data: {
  name: string;
  slug?: string;
  logoUrl?: string | null;
  description?: string | null;
  translations?: BrandTranslations | null;
}) {
  const slug = data.slug?.trim() || slugify(data.name);

  const brand = await prisma.brand.create({
    data: {
      name: data.name.trim(),
      slug,
      logoUrl: data.logoUrl ?? null,
      description: data.description ?? null,
      translations: data.translations ?? undefined,
    },
  });

  revalidateBrandCache(brand.id);
  return brand;
}

export async function updateBrand(
  id: string,
  data: {
    name: string;
    slug?: string;
    logoUrl?: string | null;
    description?: string | null;
    translations?: BrandTranslations | null;
  },
) {
  const existing = await prisma.brand.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError(`Brand ${id} not found`);

  const slug = data.slug?.trim() || slugify(data.name);

  const newName = data.name.trim();
  const newSrName =
    data.translations?.sr?.name?.trim() ?? "";
  const existingSrName =
    (existing.translations as BrandTranslations | null)?.sr?.name?.trim() ?? "";

  const searchableChanged =
    newName !== existing.name || newSrName !== existingSrName;

  const brand = await prisma.brand.update({
    where: { id },
    data: {
      name: newName,
      slug,
      logoUrl: data.logoUrl ?? null,
      description: data.description ?? null,
      translations: data.translations ?? undefined,
    },
  });

  if (searchableChanged) {
    const products = await prisma.product.findMany({
      where: { brandId: id, deletedAt: null },
      select: { id: true },
    });
    for (const p of products) {
      await refreshProductSearchText(prisma, p.id);
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