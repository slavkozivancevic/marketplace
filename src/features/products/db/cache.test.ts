import { describe, it, expect, vi, beforeEach } from "vitest";

// `updateTag` is the whole point of this file's split: it throws "can only be
// called from within a Server Action" anywhere else, and the Stripe webhook is
// a Route Handler. Mocking next/cache lets us assert which of the two tag APIs
// each variant reaches for, which is exactly what regressed in production.
const updateTag = vi.fn();
const revalidateTag = vi.fn();
const revalidatePath = vi.fn();

vi.mock("next/cache", () => ({
  updateTag: (...args: unknown[]) => updateTag(...args),
  revalidateTag: (...args: unknown[]) => revalidateTag(...args),
  revalidatePath: (...args: unknown[]) => revalidatePath(...args),
}));

const { CacheTags } = await import("@/lib/cache/tags");
const { revalidateProductCache, revalidateProductCacheFromRoute } = await import(
  "./cache"
);

const ORG_TAG = CacheTags.products.all("org_1");
const PRODUCT_TAG = CacheTags.products.byId("org_1", "prod_1");

beforeEach(() => {
  updateTag.mockClear();
  revalidateTag.mockClear();
  revalidatePath.mockClear();
});

describe("revalidateProductCache (Server Actions)", () => {
  it("uses updateTag for the org-scoped admin tags", () => {
    revalidateProductCache("org_1", "prod_1");

    // Read-your-own-writes: the admin who just saved navigates straight back to
    // the list, so these two must not be stale-while-revalidate.
    expect(updateTag).toHaveBeenCalledWith(ORG_TAG);
    expect(updateTag).toHaveBeenCalledWith(PRODUCT_TAG);
  });
});

describe("revalidateProductCacheFromRoute (Route Handlers)", () => {
  it("never calls updateTag", () => {
    revalidateProductCacheFromRoute("org_1", "prod_1");

    // The regression: calling updateTag here threw after the order transaction
    // had already committed, so every Stripe checkout webhook answered 500 and
    // permanently skipped the post-commit coupon + purchase-event writes.
    expect(updateTag).not.toHaveBeenCalled();
  });

  it("expires the org-scoped admin tags immediately instead", () => {
    revalidateProductCacheFromRoute("org_1", "prod_1");

    // `{ expire: 0 }` rather than "max": nothing here is read-your-own-writes,
    // but "max" is stale-while-revalidate and would serve pre-order stock once
    // more.
    expect(revalidateTag).toHaveBeenCalledWith(ORG_TAG, { expire: 0 });
    expect(revalidateTag).toHaveBeenCalledWith(PRODUCT_TAG, { expire: 0 });
  });

  it("busts the same storefront caches as the Server Action variant", () => {
    revalidateProductCacheFromRoute("org_1", "prod_1");
    const fromRoute = {
      tags: revalidateTag.mock.calls.map(([tag]) => tag).sort(),
      paths: revalidatePath.mock.calls.map(([path]) => path).sort(),
    };

    revalidateTag.mockClear();
    revalidatePath.mockClear();
    revalidateProductCache("org_1", "prod_1");
    const fromAction = {
      // The action variant sends these two through updateTag, so add them back
      // before comparing - everything else must match exactly.
      tags: [
        ...revalidateTag.mock.calls.map(([tag]) => tag),
        ORG_TAG,
        PRODUCT_TAG,
      ].sort(),
      paths: revalidatePath.mock.calls.map(([path]) => path).sort(),
    };

    expect(fromRoute.tags).toEqual(fromAction.tags);
    expect(fromRoute.paths).toEqual(fromAction.paths);
  });
});
