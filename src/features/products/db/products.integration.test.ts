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
