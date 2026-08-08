import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { prisma } from "@/core/db/prisma";
import { resolveRequestContext } from "@/lib/auth/resolveRequestContext";

const querySchema = z.object({
  // Type of entity we're checking. The unique constraint lives on the
  // per-entity translation table - one route handles all three.
  entity: z.enum(["brand", "category", "product", "tag"]),
  locale: z.string().min(2).max(8),
  slug: z.string().min(1).max(200),
  // When editing, callers pass the entity id so the existing row that
  // already owns the slug doesn't count as a collision.
  excludeId: z.string().min(1).optional(),
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
    locale: req.nextUrl.searchParams.get("locale"),
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
