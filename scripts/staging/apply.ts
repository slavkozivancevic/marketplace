// Staging catalog curation - applies the content dataset in ./content to the
// staging Neon DB. Idempotent: safe to re-run after a partial failure.
//
// Run:
//   DATABASE_URL=<direct-neon-url> npx tsx scripts/staging/apply.ts
//
// Phases:
//   A. resolve target user/org + reference data
//   B. new variant-defining attributes (volume, platform) + category links
//   C. category translations (proper de/es names, localized slugs + SlugHistory)
//   D. brand translations (clean slugs, 4-locale descriptions) + logos + backdrop
//   E. coupons
//   F. product ownership -> Proton org / Slavko
//   G. per-product: brand fix, 4-locale translations (+SlugHistory), variant plans
//   H. the two hand-made Proton products: meta fill + Aurora color variants
//   I. searchText rebuild for every product (mirrors refreshProductSearchText)

import { PrismaClient, Prisma } from "../../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { electronics } from "./content/products-electronics";
import { fashion } from "./content/products-fashion";
import { homeSports } from "./content/products-home-sports";
import { misc } from "./content/products-misc";
import { brands as brandContent } from "./content/brands";
import { categories as categoryContent } from "./content/categories";
import type { Locale, ProductContent } from "./content/types";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const LOCALES: Locale[] = ["en", "sr", "de", "es"];
const DEFAULT_LOCALE: Locale = "en";
const SITE = "MarketVerse";

const TARGET_USER_EMAIL = "slavko.zivancevic@protonmail.com";
const TARGET_ORG_NAME = "Slavko Zivancevic's Proton Organization";
const SEED_ORG_NAMES = ["Demo Store", "Tech Haven", "Fashion Forward"];

const allProducts: Record<string, ProductContent> = {
  ...electronics,
  ...fashion,
  ...homeSports,
  ...misc,
};

const warnings: string[] = [];
function warn(msg: string) {
  warnings.push(msg);
  console.warn(`  ⚠ ${msg}`);
}

// ── helpers ──────────────────────────────────────────────────────────────────

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replaceAll("đ", "dj")
    .replaceAll("ß", "ss")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function truncateMeta(s: string, max = 158): string {
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  return `${cut.slice(0, cut.lastIndexOf(" "))}…`;
}

/** Mirror of src/lib/seo/slugHistory.ts#recordSlugChanges */
async function recordSlugChanges(
  tx: Prisma.TransactionClient,
  entityType: "PRODUCT" | "BRAND" | "CATEGORY",
  entityId: string,
  oldSlugsByLocale: Map<string, string>,
  newSlugsByLocale: Map<string, string>,
) {
  for (const [locale, oldSlug] of oldSlugsByLocale) {
    if (!oldSlug) continue;
    if (oldSlug === newSlugsByLocale.get(locale)) continue;
    await tx.slugHistory.upsert({
      where: { entityType_locale_slug: { entityType, locale, slug: oldSlug } },
      create: { entityType, entityId, locale, slug: oldSlug },
      update: { entityId, createdAt: new Date() },
    });
  }
  for (const [locale, newSlug] of newSlugsByLocale) {
    if (!newSlug) continue;
    await tx.slugHistory.deleteMany({ where: { entityType, locale, slug: newSlug } });
  }
}

// ── logo download + backdrop analysis (mirror of analyzeLogoBackdrop) ────────

const UA = "MarketVerse-staging-catalog/1.0 (slavko.zivancevic@protonmail.com)";

async function fetchImage(url: string): Promise<{ finalUrl: string; buf: Buffer } | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": UA },
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const type = res.headers.get("content-type") ?? "";
    if (type && !type.startsWith("image/")) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength === 0 || buf.byteLength > 5 * 1024 * 1024) return null;
    return { finalUrl: res.url || url, buf };
  } catch {
    return null;
  }
}

type Backdrop = "AUTO" | "LIGHT" | "DARK" | "NEUTRAL";

async function analyzeBackdrop(buf: Buffer): Promise<Backdrop> {
  try {
    const sharp = (await import("sharp")).default;
    const { data, info } = await sharp(buf)
      .resize(64, 64, { fit: "inside", withoutEnlargement: true })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const channels = info.channels;
    const pixelCount = info.width * info.height;
    if (pixelCount === 0) return "AUTO";
    let transparent = 0;
    let lumWeightedSum = 0;
    let alphaSum = 0;
    for (let i = 0; i < data.length; i += channels) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3] / 255;
      if (a < 0.85) transparent += 1;
      const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
      lumWeightedSum += lum * a;
      alphaSum += a;
    }
    const transparentFraction = transparent / pixelCount;
    if (transparentFraction < 0.05) return "NEUTRAL";
    const avgLuminance = alphaSum > 0 ? lumWeightedSum / alphaSum : 0.5;
    return avgLuminance >= 0.55 ? "DARK" : "LIGHT";
  } catch {
    return "AUTO";
  }
}

// ── phase A: resolve ─────────────────────────────────────────────────────────

async function resolveTargets() {
  const user = await prisma.user.findUnique({ where: { email: TARGET_USER_EMAIL } });
  if (!user) throw new Error(`target user ${TARGET_USER_EMAIL} not found`);
  const org = await prisma.organization.findFirst({ where: { name: TARGET_ORG_NAME } });
  if (!org) throw new Error(`target org "${TARGET_ORG_NAME}" not found`);
  const seedOrgs = await prisma.organization.findMany({ where: { name: { in: SEED_ORG_NAMES } } });
  console.log(`A. target user ${user.id} (${user.email}), org ${org.id} (${org.name}), seed orgs: ${seedOrgs.length}`);
  return { user, org, seedOrgIds: seedOrgs.map((o) => o.id) };
}

async function categoryIdByEnSlug(slug: string): Promise<string | null> {
  const t = await prisma.categoryTranslation.findUnique({
    where: { locale_slug: { locale: "en", slug } },
    select: { categoryId: true },
  });
  return t?.categoryId ?? null;
}

// ── phase B: new attributes ──────────────────────────────────────────────────

const sameLabels = (label: string) => LOCALES.map((locale) => ({ locale, label }));

async function seedNewAttributes() {
  console.log("B. attributes (volume, platform)...");
  const defs = [
    {
      key: "volume",
      order: 12,
      labels: { en: "Volume", sr: "Zapremina", de: "Füllmenge", es: "Volumen" } as Record<Locale, string>,
      options: [
        { value: "30ml", order: 0, label: "30 ml" },
        { value: "50ml", order: 1, label: "50 ml" },
        { value: "100ml", order: 2, label: "100 ml" },
        { value: "200ml", order: 3, label: "200 ml" },
      ],
      categoryEnSlug: "health-beauty",
    },
    {
      key: "platform",
      order: 13,
      labels: { en: "Platform", sr: "Platforma", de: "Plattform", es: "Plataforma" } as Record<Locale, string>,
      options: [
        { value: "pc", order: 0, label: "PC" },
        { value: "playstation", order: 1, label: "PlayStation" },
        { value: "xbox", order: 2, label: "Xbox" },
        { value: "switch", order: 3, label: "Nintendo Switch" },
      ],
      categoryEnSlug: "video-games",
    },
  ];

  for (const def of defs) {
    const labelRows = LOCALES.map((locale) => ({ locale, label: def.labels[locale] }));
    const attr = await prisma.attribute.upsert({
      where: { key: def.key },
      update: {
        type: "SELECT",
        order: def.order,
        isVariantDefining: true,
        translations: { deleteMany: {}, create: labelRows },
      },
      create: {
        key: def.key,
        type: "SELECT",
        order: def.order,
        isVariantDefining: true,
        translations: { create: labelRows },
      },
    });
    for (const opt of def.options) {
      await prisma.attributeOption.upsert({
        where: { attributeId_value: { attributeId: attr.id, value: opt.value } },
        update: { order: opt.order, translations: { deleteMany: {}, create: sameLabels(opt.label) } },
        create: {
          attributeId: attr.id,
          value: opt.value,
          order: opt.order,
          translations: { create: sameLabels(opt.label) },
        },
      });
    }
    const catId = await categoryIdByEnSlug(def.categoryEnSlug);
    if (catId) {
      await prisma.categoryAttribute.upsert({
        where: { categoryId_attributeId: { categoryId: catId, attributeId: attr.id } },
        update: { isFilterable: true },
        create: { categoryId: catId, attributeId: attr.id, order: 99, isFilterable: true },
      });
    } else {
      warn(`category ${def.categoryEnSlug} not found for attribute ${def.key}`);
    }
    console.log(`  ✓ ${def.key}`);
  }
}

// ── phase C: categories ──────────────────────────────────────────────────────

async function applyCategories() {
  console.log("C. categories...");
  // Uniqueness pre-check of planned slugs per locale.
  for (const locale of LOCALES) {
    const seen = new Map<string, string>();
    for (const [key, c] of Object.entries(categoryContent)) {
      const s = c.slugs[locale];
      if (seen.has(s)) throw new Error(`category slug collision [${locale}] ${s}: ${seen.get(s)} vs ${key}`);
      seen.set(s, key);
    }
  }
  let updated = 0;
  for (const [enSlug, c] of Object.entries(categoryContent)) {
    const catId = await categoryIdByEnSlug(enSlug);
    if (!catId) {
      warn(`category not found: ${enSlug}`);
      continue;
    }
    await prisma.$transaction(
      async (tx) => {
        const before = await tx.categoryTranslation.findMany({
          where: { categoryId: catId },
          select: { locale: true, slug: true },
        });
        const oldMap = new Map(before.map((r) => [r.locale, r.slug]));
        const newMap = new Map(LOCALES.map((l) => [l as string, c.slugs[l]]));
        await tx.categoryTranslation.deleteMany({ where: { categoryId: catId } });
        await tx.categoryTranslation.createMany({
          data: LOCALES.map((l) => ({
            categoryId: catId,
            locale: l,
            name: c.names[l],
            slug: c.slugs[l],
            description: c.desc[l],
          })),
        });
        await recordSlugChanges(tx, "CATEGORY", catId, oldMap, newMap);
      },
      { timeout: 30_000 },
    );
    updated++;
  }
  console.log(`  ✓ ${updated}/${Object.keys(categoryContent).length} categories updated`);
}

// ── phase D: brands ──────────────────────────────────────────────────────────

async function applyBrands(): Promise<Map<string, string>> {
  console.log("D. brands...");
  const brandIdBySlug = new Map<string, string>();
  for (const [enSlug, b] of Object.entries(brandContent)) {
    const existing = await prisma.brandTranslation.findFirst({
      where: { locale: "en", slug: enSlug },
      select: { brandId: true },
    });
    if (!existing) {
      warn(`brand not found: ${enSlug}`);
      continue;
    }
    const brandId = existing.brandId;
    brandIdBySlug.set(enSlug, brandId);

    // Logo: try candidates on Wikimedia Commons, resolve final thumb URL.
    let logoUrl: string | null = null;
    let backdrop: Backdrop = "AUTO";
    for (const file of b.logoFiles) {
      const url = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=512`;
      const img = await fetchImage(url);
      if (!img) continue;
      logoUrl = img.finalUrl;
      backdrop = await analyzeBackdrop(img.buf);
      break;
    }

    await prisma.$transaction(
      async (tx) => {
        const before = await tx.brandTranslation.findMany({
          where: { brandId },
          select: { locale: true, slug: true },
        });
        const oldMap = new Map(before.map((r) => [r.locale, r.slug]));
        const newMap = new Map(LOCALES.map((l) => [l as string, b.slug]));
        await tx.brandTranslation.deleteMany({ where: { brandId } });
        await tx.brandTranslation.createMany({
          data: LOCALES.map((l) => ({
            brandId,
            locale: l,
            name: b.name,
            slug: b.slug,
            description: b.desc[l],
          })),
        });
        await recordSlugChanges(tx, "BRAND", brandId, oldMap, newMap);
        if (logoUrl) {
          await tx.brand.update({
            where: { id: brandId },
            data: { logoUrl, logoBackdrop: backdrop, logoUrlDark: null, logoBackdropDark: "AUTO" },
          });
        }
      },
      { timeout: 30_000 },
    );
    console.log(`  ✓ ${b.name}${logoUrl ? ` (logo ${backdrop})` : " (logo NOT found - kept existing)"}`);
    if (!logoUrl) warn(`no logo resolved for ${b.name}`);
  }
  return brandIdBySlug;
}

// ── phase E: coupons ─────────────────────────────────────────────────────────

async function applyCoupons() {
  console.log("E. coupons...");
  const coupons = [
    {
      code: "WELCOME10",
      type: "PERCENT" as const,
      value: 10,
      minOrder: 2000,
      usageLimit: 500,
      perUserLimit: 1,
      expiresAt: new Date("2027-12-31T23:59:59Z"),
      active: true,
    },
    {
      code: "MARKETVERSE15",
      type: "PERCENT" as const,
      value: 15,
      minOrder: 10000,
      usageLimit: 200,
      perUserLimit: 2,
      expiresAt: new Date("2026-12-31T23:59:59Z"),
      active: true,
    },
    {
      code: "SUMMER5",
      type: "FIXED" as const,
      value: 500,
      minOrder: 3000,
      usageLimit: 300,
      perUserLimit: null,
      expiresAt: new Date("2026-09-30T23:59:59Z"),
      active: true,
    },
  ];
  for (const c of coupons) {
    await prisma.coupon.upsert({
      where: { code: c.code },
      update: { ...c },
      create: { ...c },
    });
    console.log(`  ✓ ${c.code}`);
  }
}

// ── phase F: ownership ───────────────────────────────────────────────────────

async function applyOwnership(orgId: string, userId: string, seedOrgIds: string[]) {
  console.log("F. ownership...");
  const res = await prisma.product.updateMany({
    where: { organizationId: { in: seedOrgIds } },
    data: { organizationId: orgId, createdById: userId, updatedById: userId },
  });
  console.log(`  ✓ ${res.count} products moved to "${TARGET_ORG_NAME}"`);
}

// ── phase G: products ────────────────────────────────────────────────────────

type VariantRow = {
  id: string;
  sku: string;
  stock: number;
  orderItems: number;
  colorValue: string | null;
};

async function applyProducts(brandIdBySlug: Map<string, string>) {
  console.log("G. products...");

  const colorAttr = await prisma.attribute.findUnique({ where: { key: "color" }, select: { id: true } });
  const attrIds = new Map<string, { id: string; options: Map<string, string> }>();
  for (const key of ["volume", "platform", "color"]) {
    const a = await prisma.attribute.findUnique({
      where: { key },
      select: { id: true, options: { select: { id: true, value: true } } },
    });
    if (a) attrIds.set(key, { id: a.id, options: new Map(a.options.map((o) => [o.value, o.id])) });
  }

  // Pre-check slug uniqueness across the whole planned catalog.
  const planned = new Map<string, Map<string, string>>(); // locale -> slug -> enSlug
  for (const locale of LOCALES) planned.set(locale, new Map());
  for (const [enSlug, content] of Object.entries(allProducts)) {
    for (const locale of LOCALES) {
      const slug = locale === "en" ? enSlug : slugify(content.t[locale].title);
      const seen = planned.get(locale)!;
      if (seen.has(slug)) throw new Error(`product slug collision [${locale}] ${slug}: ${seen.get(slug)} vs ${enSlug}`);
      seen.set(slug, enSlug);
    }
  }
  // ...and against product slugs that are NOT part of the plan (hand-made products).
  const foreign = await prisma.productTranslation.findMany({
    where: { NOT: { product: { translations: { some: { locale: "en", slug: { in: Object.keys(allProducts) } } } } } },
    select: { locale: true, slug: true },
  });
  for (const f of foreign) {
    if (planned.get(f.locale)?.has(f.slug)) {
      throw new Error(`planned slug collides with existing product [${f.locale}] ${f.slug}`);
    }
  }

  let done = 0;
  for (const [enSlug, content] of Object.entries(allProducts)) {
    const enRow = await prisma.productTranslation.findUnique({
      where: { locale_slug: { locale: "en", slug: enSlug } },
      select: { productId: true },
    });
    if (!enRow) {
      warn(`product not found by en slug: ${enSlug}`);
      continue;
    }
    const product = await prisma.product.findUnique({
      where: { id: enRow.productId },
      select: {
        id: true,
        price: true,
        compareAtPrice: true,
        stock: true,
        brandId: true,
        media: { select: { id: true, order: true }, orderBy: { order: "asc" } },
        variants: {
          select: {
            id: true,
            sku: true,
            stock: true,
            _count: { select: { orderItems: true } },
            attributeValues: {
              select: { attribute: { select: { key: true } }, option: { select: { value: true } } },
            },
          },
        },
      },
    });
    if (!product) continue;
    const productId = product.id;

    // 1) brand
    const targetBrandId =
      content.brand === "keep" ? product.brandId : content.brand === null ? null : (brandIdBySlug.get(content.brand) ?? null);
    if (content.brand !== "keep" && content.brand !== null && !brandIdBySlug.has(content.brand)) {
      warn(`${enSlug}: brand slug ${content.brand} unresolved, clearing brand`);
    }
    if (targetBrandId !== product.brandId) {
      await prisma.product.update({ where: { id: productId }, data: { brandId: targetBrandId } });
    }

    // 2) translations (+ slug history)
    await prisma.$transaction(
      async (tx) => {
        const before = await tx.productTranslation.findMany({
          where: { productId },
          select: { locale: true, slug: true },
        });
        const oldMap = new Map(before.map((r) => [r.locale, r.slug]));
        const rows = LOCALES.map((locale) => {
          const t = content.t[locale];
          const slug = locale === "en" ? enSlug : slugify(t.title);
          return {
            productId,
            locale,
            title: t.title,
            slug,
            description: t.desc,
            shortDescription: t.short,
            metaTitle: `${t.title} | ${SITE}`,
            metaDescription: truncateMeta(t.short),
            searchText: null as string | null,
          };
        });
        const newMap = new Map(rows.map((r) => [r.locale, r.slug]));
        await tx.productTranslation.deleteMany({ where: { productId } });
        await tx.productTranslation.createMany({ data: rows });
        await recordSlugChanges(tx, "PRODUCT", productId, oldMap, newMap);
      },
      { timeout: 30_000 },
    );

    // 3) variants
    const variants: VariantRow[] = product.variants.map((v) => ({
      id: v.id,
      sku: v.sku,
      stock: v.stock,
      orderItems: v._count.orderItems,
      colorValue: v.attributeValues.find((av) => av.attribute.key === "color")?.option.value ?? null,
    }));
    const plan = content.variants;

    if (plan.mode === "none" && variants.length > 0) {
      const deletable = variants.filter((v) => v.orderItems === 0);
      const survivors = variants.filter((v) => v.orderItems > 0);
      if (deletable.length > 0) {
        await prisma.productVariant.deleteMany({ where: { id: { in: deletable.map((v) => v.id) } } });
      }
      if (survivors.length === 0) {
        const stock = deletable.reduce((s, v) => s + v.stock, 0) || 40;
        await prisma.product.update({ where: { id: productId }, data: { stock } });
      } else if (survivors.length < variants.length) {
        warn(`${enSlug}: kept ${survivors.length} order-referenced variant(s)`);
      }
    } else if (plan.mode === "colors" && colorAttr) {
      const keep = variants.filter((v) => v.orderItems > 0 || (v.colorValue !== null && plan.palette.includes(v.colorValue)));
      let toDelete = variants.filter((v) => !keep.includes(v));
      if (keep.length === 0) {
        // Palette missed every variant: keep the two best-stocked instead.
        const fallback = [...variants].sort((a, b) => b.stock - a.stock).slice(0, 2);
        toDelete = variants.filter((v) => !fallback.includes(v));
        warn(`${enSlug}: color palette matched nothing, kept top-stock variants`);
      }
      if (toDelete.length > 0) {
        await prisma.productVariant.deleteMany({ where: { id: { in: toDelete.map((v) => v.id) } } });
      }
    } else if (plan.mode === "options") {
      const axis = attrIds.get(plan.attrKey);
      if (!axis) {
        warn(`${enSlug}: attribute ${plan.attrKey} missing, skipped variant rebuild`);
      } else {
        // Idempotency: if current variants already use this axis, assume done.
        const alreadyDone = variants.length > 0 && variants.every((v) =>
          product.variants.find((pv) => pv.id === v.id)!.attributeValues.some((av) => av.attribute.key === plan.attrKey),
        );
        if (!alreadyDone) {
          const deletable = variants.filter((v) => v.orderItems === 0);
          if (deletable.length > 0) {
            await prisma.productVariant.deleteMany({ where: { id: { in: deletable.map((v) => v.id) } } });
          }
          const kept = variants.length - deletable.length;
          if (kept > 0) warn(`${enSlug}: ${kept} order-referenced variant(s) kept alongside new ${plan.attrKey} axis`);
          const primaryMedia = product.media[0];
          let idx = 0;
          const createdPrices: number[] = [];
          for (const opt of plan.options) {
            const optionId = axis.options.get(opt.value);
            if (!optionId) {
              warn(`${enSlug}: option ${opt.value} missing on ${plan.attrKey}`);
              continue;
            }
            const price = Math.round(product.price * opt.priceFactor);
            createdPrices.push(price);
            const created = await prisma.productVariant.create({
              data: {
                productId,
                sku: `${enSlug.toUpperCase()}-${opt.value.toUpperCase()}`,
                price,
                compareAtPrice: opt.priceFactor === 1 ? product.compareAtPrice : null,
                stock: opt.stock,
                order: idx++,
                attributeValues: { create: [{ attributeId: axis.id, optionId }] },
              },
            });
            if (primaryMedia) {
              await prisma.productVariantMedia.createMany({
                data: [{ variantId: created.id, mediaId: primaryMedia.id, order: 0 }],
                skipDuplicates: true,
              });
            }
          }
          const minPrice = createdPrices.length ? Math.min(...createdPrices) : product.price;
          await prisma.product.update({ where: { id: productId }, data: { stock: null, price: minPrice } });
        }
      }
    }

    done++;
    if (done % 20 === 0) console.log(`  ...${done}/${Object.keys(allProducts).length}`);
  }
  console.log(`  ✓ ${done}/${Object.keys(allProducts).length} products updated`);
}

// ── phase H: hand-made Proton products ───────────────────────────────────────

async function applyProtonExtras(orgId: string) {
  console.log("H. hand-made Proton products...");
  const products = await prisma.product.findMany({
    where: { organizationId: orgId, deletedAt: null, translations: { some: { locale: "en", slug: { notIn: Object.keys(allProducts) } } } },
    select: {
      id: true,
      price: true,
      stock: true,
      translations: { select: { id: true, locale: true, title: true, shortDescription: true, metaTitle: true, metaDescription: true } },
      variants: { select: { id: true } },
      media: { select: { id: true, order: true }, orderBy: { order: "asc" } },
    },
  });
  const colorAttr = await prisma.attribute.findUnique({
    where: { key: "color" },
    select: { id: true, options: { select: { id: true, value: true } } },
  });

  for (const p of products) {
    // Fill missing meta fields, keep everything the user typed.
    for (const t of p.translations) {
      const data: { metaTitle?: string; metaDescription?: string } = {};
      if (!t.metaTitle) data.metaTitle = `${t.title} | ${SITE}`;
      if (!t.metaDescription && t.shortDescription) data.metaDescription = truncateMeta(t.shortDescription);
      if (Object.keys(data).length > 0) {
        await prisma.productTranslation.update({ where: { id: t.id }, data });
      }
    }
    // Aurora X1 (or any variant-less phone here): give it a color axis.
    if (p.variants.length === 0 && colorAttr) {
      const en = p.translations.find((t) => t.locale === "en");
      const skuBase = slugify(en?.title ?? "product").toUpperCase();
      const colors: { value: string; stock: number }[] = [
        { value: "black", stock: 34 },
        { value: "blue", stock: 32 },
        { value: "white", stock: 32 },
      ];
      const primaryMedia = p.media[0];
      for (const [i, c] of colors.entries()) {
        const optionId = colorAttr.options.find((o) => o.value === c.value)?.id;
        if (!optionId) continue;
        const created = await prisma.productVariant.create({
          data: {
            productId: p.id,
            sku: `${skuBase}-${c.value.toUpperCase()}`,
            price: p.price,
            stock: c.stock,
            order: i,
            attributeValues: { create: [{ attributeId: colorAttr.id, optionId }] },
          },
        });
        if (primaryMedia) {
          await prisma.productVariantMedia.createMany({
            data: [{ variantId: created.id, mediaId: primaryMedia.id, order: 0 }],
            skipDuplicates: true,
          });
        }
      }
      await prisma.product.update({ where: { id: p.id }, data: { stock: null } });
      console.log(`  ✓ color variants added to "${p.translations.find((t) => t.locale === "en")?.title}"`);
    }
  }
  console.log(`  ✓ meta filled on ${products.length} hand-made product(s)`);
}

// ── phase I: searchText rebuild (mirror of refreshProductSearchText) ─────────

async function rebuildSearchText() {
  console.log("I. searchText rebuild...");
  const products = await prisma.product.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      translations: { select: { locale: true, title: true, shortDescription: true } },
      brand: { select: { translations: { select: { locale: true, name: true } } } },
      categories: { select: { category: { select: { translations: { select: { locale: true, name: true } } } } } },
    },
  });
  const pick = <T extends { locale: string }>(rows: T[], locale: string): T | undefined =>
    rows.find((r) => r.locale === locale) ?? rows.find((r) => r.locale === DEFAULT_LOCALE);

  for (const p of products) {
    for (const locale of LOCALES) {
      const productT = p.translations.find((t) => t.locale === locale);
      if (!productT) continue;
      const brandT = p.brand ? pick(p.brand.translations, locale) : null;
      const parts: string[] = [];
      if (productT.title) parts.push(productT.title);
      if (productT.shortDescription) parts.push(productT.shortDescription);
      if (brandT?.name) parts.push(brandT.name);
      for (const c of p.categories) {
        const catT = pick(c.category.translations, locale);
        if (catT?.name) parts.push(catT.name);
      }
      await prisma.productTranslation.updateMany({
        where: { productId: p.id, locale },
        data: { searchText: parts.filter((s) => s.trim().length > 0).join(" ") },
      });
    }
  }
  console.log(`  ✓ searchText refreshed for ${products.length} products x ${LOCALES.length} locales`);
}

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("\n🛠  Staging catalog curation\n");
  const { user, org, seedOrgIds } = await resolveTargets();
  await seedNewAttributes();
  await applyCategories();
  const brandIdBySlug = await applyBrands();
  await applyCoupons();
  await applyOwnership(org.id, user.id, seedOrgIds);
  await applyProducts(brandIdBySlug);
  await applyProtonExtras(org.id);
  await rebuildSearchText();
  console.log(`\n✅ Done. ${warnings.length} warning(s).`);
  if (warnings.length) {
    console.log("Warnings:");
    for (const w of warnings) console.log(` - ${w}`);
  }
}

main()
  .catch((e) => {
    console.error("❌ apply failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
