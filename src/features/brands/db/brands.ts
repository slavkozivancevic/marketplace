import { prisma } from "@/core/db/prisma";
import { NotFoundError } from "@/features/common/errors/domainErrors";
import { revalidateBrandCache } from "./cache";
import { slugify } from "@/lib/utils";

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
}) {
  const slug = data.slug?.trim() || slugify(data.name);

  const brand = await prisma.brand.create({
    data: {
      name: data.name.trim(),
      slug,
      logoUrl: data.logoUrl ?? null,
      description: data.description ?? null,
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
  },
) {
  const existing = await prisma.brand.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError(`Brand ${id} not found`);

  const slug = data.slug?.trim() || slugify(data.name);

  const brand = await prisma.brand.update({
    where: { id },
    data: {
      name: data.name.trim(),
      slug,
      logoUrl: data.logoUrl ?? null,
      description: data.description ?? null,
    },
  });

  revalidateBrandCache(brand.id);
  return brand;
}

export async function deleteBrand(id: string) {
  const existing = await prisma.brand.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError(`Brand ${id} not found`);

  await prisma.brand.delete({ where: { id } });
  revalidateBrandCache(id);
}