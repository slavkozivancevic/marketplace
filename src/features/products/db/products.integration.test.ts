import { describe, it, expect, beforeEach } from "vitest";
import { productRepository } from "./products";
import { NotFoundError } from "@/features/common/errors/domainErrors";
import {
  prisma,
  resetDb,
  createUser,
  createOrganization,
  createProduct,
} from "../../../../test/integration/helpers";

// productRepository is a plain factory over tenantPrisma - no auth/i18n context,
// so its DB-layer bulk ops are integration-testable directly. The key property
// is tenant isolation: a bulk op must never reach across orgs.
beforeEach(async () => {
  await resetDb();
});

/** Short unique fragment, so `@@unique([locale, slug])` never collides. */
function suffix() {
  return Math.random().toString(36).slice(2, 10);
}

describe("productRepository.bulkUpdateStatus", () => {
  it("updates status, bumps version, and snapshots history for the org's products", async () => {
    const org = await createOrganization();
    const user = await createUser();
    const p1 = await createProduct({ organizationId: org.id, status: "DRAFT" });
    const p2 = await createProduct({ organizationId: org.id, status: "DRAFT" });
    const repo = productRepository({ organizationId: org.id, userId: user.id });

    const updated = await repo.bulkUpdateStatus([p1.id, p2.id], "PUBLISHED");

    expect(updated).toHaveLength(2);
    const rows = await prisma.product.findMany({ where: { id: { in: [p1.id, p2.id] } } });
    expect(rows.every((r) => r.status === "PUBLISHED")).toBe(true);
    // version starts at 1 -> incremented to 2 on the status change.
    expect(rows.every((r) => r.version === 2)).toBe(true);
    // Each change is snapshotted for the product history / rollback.
    expect(
      await prisma.productHistory.count({ where: { productId: { in: [p1.id, p2.id] } } }),
    ).toBe(2);
  });

  it("never touches another org's products (tenant isolation)", async () => {
    const orgA = await createOrganization();
    const orgB = await createOrganization();
    const user = await createUser();
    const pA = await createProduct({ organizationId: orgA.id, status: "DRAFT" });
    const pB = await createProduct({ organizationId: orgB.id, status: "DRAFT" });
    const repoA = productRepository({ organizationId: orgA.id, userId: user.id });

    // orgA passes both ids, but only its own product is in scope.
    await repoA.bulkUpdateStatus([pA.id, pB.id], "PUBLISHED");

    expect((await prisma.product.findUnique({ where: { id: pA.id } }))?.status).toBe("PUBLISHED");
    expect((await prisma.product.findUnique({ where: { id: pB.id } }))?.status).toBe("DRAFT");
  });

  it("throws NotFoundError when no id belongs to the org", async () => {
    const orgA = await createOrganization();
    const orgB = await createOrganization();
    const user = await createUser();
    const pB = await createProduct({ organizationId: orgB.id, status: "DRAFT" });
    const repoA = productRepository({ organizationId: orgA.id, userId: user.id });

    await expect(repoA.bulkUpdateStatus([pB.id], "PUBLISHED")).rejects.toBeInstanceOf(
      NotFoundError,
    );
    // Rolled back - the other org's product is untouched.
    expect((await prisma.product.findUnique({ where: { id: pB.id } }))?.status).toBe("DRAFT");
  });
});

describe("productRepository.duplicate", () => {
  it("carries the source's categories and tags onto the copy", async () => {
    const org = await createOrganization();
    const user = await createUser();
    const product = await createProduct({ organizationId: org.id });
    const category = await prisma.category.create({
      data: {
        translations: { create: { locale: "en", name: "Shoes", slug: `shoes-${suffix()}` } },
      },
    });
    const tag = await prisma.tag.create({
      data: {
        translations: { create: { locale: "en", name: "New", slug: `new-${suffix()}` } },
      },
    });
    await prisma.productCategory.create({
      data: { productId: product.id, categoryId: category.id },
    });
    await prisma.productTag.create({ data: { productId: product.id, tagId: tag.id } });

    const repo = productRepository({ organizationId: org.id, userId: user.id });
    const copy = await repo.duplicate(product.id);

    // The copy used to be created with neither join row, so it sat off every
    // category page and out of every tag facet while looking complete.
    expect(
      await prisma.productCategory.findMany({ where: { productId: copy.id } }),
    ).toEqual([expect.objectContaining({ categoryId: category.id })]);
    expect(await prisma.productTag.findMany({ where: { productId: copy.id } })).toEqual([
      expect.objectContaining({ tagId: tag.id }),
    ]);
  });

  it("gives every locale's slug the same copy marker", async () => {
    const org = await createOrganization();
    const user = await createUser();
    const product = await createProduct({ organizationId: org.id });
    const base = suffix();
    await prisma.productTranslation.createMany({
      data: [
        { productId: product.id, locale: "en", title: "Nike Air", slug: `nike-air-${base}`, description: "d" },
        { productId: product.id, locale: "sr", title: "Patike Nike", slug: `patike-nike-${base}`, description: "d" },
      ],
    });

    const repo = productRepository({ organizationId: org.id, userId: user.id });
    const copy = await repo.duplicate(product.id);

    const rows = await prisma.productTranslation.findMany({
      where: { productId: copy.id },
      orderBy: { locale: "asc" },
    });
    const byLocale = new Map(rows.map((r) => [r.locale, r.slug]));
    // The default locale used to derive its slug from the "Copy of" TITLE
    // (`copy-of-nike-air`) while the others kept the source slug plus a marker,
    // so one product's slugs followed two different rules.
    expect(byLocale.get("en")).toMatch(new RegExp(`^nike-air-${base}-copy-[0-9a-z]+$`));
    expect(byLocale.get("sr")).toMatch(new RegExp(`^patike-nike-${base}-copy-[0-9a-z]+$`));
  });

  it("names the copy after the source for the audit trail", async () => {
    const org = await createOrganization();
    const user = await createUser();
    const product = await createProduct({ organizationId: org.id });
    await prisma.productTranslation.create({
      data: { productId: product.id, locale: "en", title: "Nike Air", slug: `nike-air-${suffix()}`, description: "d" },
    });

    const repo = productRepository({ organizationId: org.id, userId: user.id });
    const copy = await repo.duplicate(product.id);

    // The audit log renders this as "Copied from: Nike Air" instead of a UUID.
    expect(copy.sourceLabel).toBe("Nike Air");
  });
});
