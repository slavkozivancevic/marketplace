import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  prisma,
  resetDb,
  createOrganization,
  createProduct,
} from "../../../../test/integration/helpers";

// bulkUpsertTranslations is a server action: mock only the auth/side-effect
// boundaries (request context, permission gate, audit) so the real per-row
// upsert logic - slug derivation + uniqueness, description fallback chain,
// productRef resolution, per-row error codes - runs against the real DB.
let testOrgId = "";
vi.mock("@/lib/auth/resolveRequestContext", () => ({
  resolveRequestContext: vi.fn(async () => ({ organizationId: testOrgId, userId: null })),
}));
vi.mock("@/lib/auth/permissions", () => ({
  requirePermission: vi.fn(),
}));
vi.mock("@/features/audit/db/audit", () => ({
  recordAudit: vi.fn(),
  SYSTEM_ACTOR: {},
}));

import {
  bulkUpsertTranslations,
  type TranslationImportRow,
  type TranslationImportResult,
} from "./translations";

beforeEach(async () => {
  await resetDb();
  testOrgId = "";
});

// Narrow the action's success/error union for the happy-path assertions.
async function upsert(rows: TranslationImportRow[]): Promise<TranslationImportResult> {
  const res = await bulkUpsertTranslations(rows);
  if ("result" in res) return res.result;
  throw new Error("bulkUpsertTranslations returned an error result");
}

async function translation(productId: string, locale: string) {
  return prisma.productTranslation.findUnique({
    where: { productId_locale: { productId, locale } },
  });
}

describe("bulkUpsertTranslations - CSV import", () => {
  it("creates a new translation and derives the slug from the title", async () => {
    const org = await createOrganization();
    testOrgId = org.id;
    const product = await createProduct({ organizationId: org.id });

    const result = await upsert([
      { productRef: product.id, locale: "sr", title: "Naslov Proizvoda", description: "Opis" },
    ]);

    expect(result.upserted).toBe(1);
    expect(result.errors).toEqual([]);
    const tr = await translation(product.id, "sr");
    expect(tr).toMatchObject({ title: "Naslov Proizvoda", slug: "naslov-proizvoda", description: "Opis" });
  });

  it("updates an existing translation and falls back to its description when the row omits it", async () => {
    const org = await createOrganization();
    testOrgId = org.id;
    const product = await createProduct({ organizationId: org.id });
    await prisma.productTranslation.create({
      data: { productId: product.id, locale: "sr", title: "Staro", slug: "staro", description: "Postojeci opis" },
    });

    const result = await upsert([
      // No description on the row -> keep the existing one. No slug -> keep existing.
      { productRef: product.id, locale: "sr", title: "Novi naslov" },
    ]);

    expect(result.upserted).toBe(1);
    const tr = await translation(product.id, "sr");
    expect(tr).toMatchObject({ title: "Novi naslov", slug: "staro", description: "Postojeci opis" });
  });

  it("reports per-row errors without aborting the rest of the batch", async () => {
    const org = await createOrganization();
    testOrgId = org.id;
    const product = await createProduct({ organizationId: org.id });

    const result = await upsert([
      { productRef: product.id, locale: "xx", title: "T", description: "D" }, // invalidLocale
      { productRef: product.id, locale: "sr", title: "   ", description: "D" }, // titleRequired
      { productRef: "00000000-0000-0000-0000-000000000000", locale: "sr", title: "T", description: "D" }, // productNotFound
      { productRef: product.id, locale: "de", title: "Gut", description: "D" }, // valid
    ]);

    expect(result.totalRows).toBe(4);
    expect(result.upserted).toBe(1);
    expect(result.errors.map((e) => e.code).sort()).toEqual([
      "invalidLocale",
      "productNotFound",
      "titleRequired",
    ]);
    // Only the valid row was written.
    expect(await translation(product.id, "de")).toMatchObject({ title: "Gut" });
    expect(await translation(product.id, "sr")).toBeNull();
  });

  it("keeps slugs unique per locale across products (collision suffix)", async () => {
    const org = await createOrganization();
    testOrgId = org.id;
    const p1 = await createProduct({ organizationId: org.id });
    const p2 = await createProduct({ organizationId: org.id });

    const result = await upsert([
      { productRef: p1.id, locale: "sr", title: "Isti Naslov", description: "D" },
      { productRef: p2.id, locale: "sr", title: "Isti Naslov", description: "D" },
    ]);

    expect(result.upserted).toBe(2);
    const t1 = await translation(p1.id, "sr");
    const t2 = await translation(p2.id, "sr");
    expect(t1?.slug).toBe("isti-naslov");
    expect(t2?.slug).toBe("isti-naslov-2");
  });

  it("resolves productRef by default-locale slug, not just UUID", async () => {
    const org = await createOrganization();
    testOrgId = org.id;
    const product = await createProduct({ organizationId: org.id });
    // Default-locale (en) translation gives the product a referenceable slug.
    await prisma.productTranslation.create({
      data: { productId: product.id, locale: "en", title: "Widget", slug: "widget", description: "A widget" },
    });

    const result = await upsert([
      { productRef: "widget", locale: "sr", title: "Vidzet", description: "Opis" },
    ]);

    expect(result.upserted).toBe(1);
    expect(await translation(product.id, "sr")).toMatchObject({ title: "Vidzet" });
  });
});
