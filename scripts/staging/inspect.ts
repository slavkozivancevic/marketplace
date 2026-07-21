// Read-only audit of the staging catalog. Writes a JSON report for the
// content-curation pass (scripts/staging/*) and prints a summary.
import { PrismaClient } from "../../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { writeFileSync } from "node:fs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const OUT = process.env.AUDIT_OUT ?? "staging-audit.json";

async function main() {
  const users = await prisma.user.findMany({
    select: {
      id: true, email: true, name: true, role: true, clerkUserId: true, activeOrgId: true,
      memberships: { select: { orgId: true, role: true, organization: { select: { name: true } } } },
    },
  });

  const orgs = await prisma.organization.findMany({
    select: {
      id: true, name: true, verified: true, shippingFlatRate: true, shippingFreeThreshold: true,
      _count: { select: { products: true, members: true } },
      members: { select: { role: true, user: { select: { email: true, name: true } } } },
    },
  });

  const products = await prisma.product.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: "asc" },
    select: {
      id: true, price: true, compareAtPrice: true, stock: true, status: true,
      organizationId: true, createdById: true, updatedById: true, brandId: true,
      avgRating: true, ratingCount: true, isDigital: true, requiresShipping: true,
      weight: true, weightUnit: true,
      organization: { select: { name: true } },
      brand: { select: { translations: { where: { locale: "en" }, select: { name: true } } } },
      translations: {
        select: {
          locale: true, title: true, slug: true, description: true,
          shortDescription: true, metaTitle: true, metaDescription: true, searchText: true,
        },
      },
      categories: { select: { category: { select: { id: true, translations: { where: { locale: "en" }, select: { name: true, slug: true } } } } } },
      tags: { select: { tag: { select: { slug: true } } } },
      media: { select: { id: true, url: true, order: true, mediaType: true } },
      attributeValues: {
        select: {
          attribute: { select: { key: true, type: true } },
          option: { select: { value: true } },
          valueNumeric: true, valueBool: true,
        },
      },
      variants: {
        orderBy: { order: "asc" },
        select: {
          id: true, sku: true, price: true, compareAtPrice: true, stock: true, order: true,
          attributeValues: { select: { attribute: { select: { key: true } }, option: { select: { value: true } } } },
          _count: { select: { orderItems: true } },
        },
      },
      _count: { select: { orderItems: true, reviews: true, wishlists: true } },
    },
  });

  const brands = await prisma.brand.findMany({
    select: {
      id: true, logoUrl: true, logoUrlDark: true, logoBackdrop: true, logoBackdropDark: true,
      translations: { select: { locale: true, name: true, slug: true, description: true } },
      _count: { select: { products: true } },
    },
  });

  const categories = await prisma.category.findMany({
    orderBy: [{ parentId: "asc" }, { order: "asc" }],
    select: {
      id: true, parentId: true, order: true, isActive: true, isFeatured: true, imageUrl: true,
      translations: { select: { locale: true, name: true, slug: true, description: true } },
      _count: { select: { products: true } },
    },
  });

  const attributes = await prisma.attribute.findMany({
    orderBy: { order: "asc" },
    select: {
      id: true, key: true, type: true, unit: true, order: true, isVariantDefining: true,
      translations: { select: { locale: true, label: true } },
      options: {
        orderBy: { order: "asc" },
        select: { id: true, value: true, order: true, translations: { select: { locale: true, label: true } } },
      },
      categories: { select: { categoryId: true, isFilterable: true } },
      _count: { select: { values: true, variantValues: true } },
    },
  });

  const coupons = await prisma.coupon.findMany({
    select: {
      id: true, code: true, type: true, value: true, minOrder: true, usageLimit: true,
      usageCount: true, perUserLimit: true, expiresAt: true, active: true,
    },
  });

  const tags = await prisma.tag.findMany({ select: { id: true, name: true, slug: true, _count: { select: { products: true } } } });

  const slugHistoryCount = await prisma.slugHistory.count();
  const orderCount = await prisma.order.count();

  const report = { users, orgs, products, brands, categories, attributes, coupons, tags, slugHistoryCount, orderCount };
  writeFileSync(OUT, JSON.stringify(report, null, 2), "utf8");

  console.log(`users: ${users.length}, orgs: ${orgs.length}, products: ${products.length}, brands: ${brands.length}, categories: ${categories.length}, attributes: ${attributes.length}, coupons: ${coupons.length}, tags: ${tags.length}, orders: ${orderCount}, slugHistory: ${slugHistoryCount}`);
  console.log(`report -> ${OUT}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
