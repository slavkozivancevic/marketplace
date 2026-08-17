import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { prisma } from "@/core/db/prisma";
import { resolveRequestContext } from "@/lib/auth/resolveRequestContext";

const querySchema = z
  .object({
    // Type of entity we're checking. For the translated ones the unique
    // constraint lives on the per-entity translation table; `attribute` is the
    // odd one out - its `key` is globally unique with no locale dimension.
    entity: z.enum(["brand", "category", "product", "tag", "attribute"]),
    locale: z.string().min(2).max(8).optional(),
    slug: z.string().min(1).max(200),
    // When editing, callers pass the entity id so the existing row that
    // already owns the slug doesn't count as a collision.
    excludeId: z.string().min(1).optional(),
  })
  .refine((q) => q.entity === "attribute" || !!q.locale, {
    message: "locale is required for translation-backed entities",
    path: ["locale"],
  });

/**
 * Lightweight "is this slug free in this locale" check for the admin
 * forms. Returns `{ available: boolean }` so the form can render a green
 * checkmark / red X next to the slug input. Cache headers are
 * deliberately omitted - the answer can change after any save and we
 * want the form to see the latest state.
 */
export async function GET(req: NextRequest) {
  // Auth: only signed-in operators can probe slug uniqueness. This
  // endpoint doesn't leak any new data (slugs are public), but rate-
  // gating it via auth keeps random clients from hammering the table.
  await resolveRequestContext();

  const parsed = querySchema.safeParse({
    entity: req.nextUrl.searchParams.get("entity"),
    // `searchParams.get` yields null for an absent param, and zod's
    // `.optional()` accepts undefined but NOT null - without this the
    // locale-less `attribute` check failed validation and the form showed
    // "check failed" for every keystroke.
    locale: req.nextUrl.searchParams.get("locale") ?? undefined,
    slug: req.nextUrl.searchParams.get("slug"),
    excludeId: req.nextUrl.searchParams.get("excludeId") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { entity, locale, slug, excludeId } = parsed.data;

  // Handled first, and returned from, for two reasons: `Attribute.key` is a
  // single globally unique column with no locale dimension, and splitting it
  // out here narrows `locale` to a plain string for every lookup below (the
  // schema's refine guarantees it, but that isn't visible to the type system).
  if (entity === "attribute") {
    const row = await prisma.attribute.findUnique({
      where: { key: slug },
      select: { id: true },
    });
    return NextResponse.json({ available: !(row != null && row.id !== excludeId) });
  }

  if (!locale) {
    // Unreachable through the schema above; kept so the narrowing is sound
    // rather than asserted away.
    return NextResponse.json({ error: "Invalid query" }, { status: 400 });
  }

  let exists = false;
  switch (entity) {
    case "brand": {
      const row = await prisma.brandTranslation.findUnique({
        where: { locale_slug: { locale, slug } },
        select: { brandId: true },
      });
      exists = row != null && row.brandId !== excludeId;
      break;
    }
    case "category": {
      const row = await prisma.categoryTranslation.findUnique({
        where: { locale_slug: { locale, slug } },
        select: { categoryId: true },
      });
      exists = row != null && row.categoryId !== excludeId;
      break;
    }
    case "product": {
      const row = await prisma.productTranslation.findUnique({
        where: { locale_slug: { locale, slug } },
        select: { productId: true },
      });
      exists = row != null && row.productId !== excludeId;
      break;
    }
    case "tag": {
      const row = await prisma.tagTranslation.findUnique({
        where: { locale_slug: { locale, slug } },
        select: { tagId: true },
      });
      exists = row != null && row.tagId !== excludeId;
      break;
    }
  }

  return NextResponse.json({ available: !exists });
}
