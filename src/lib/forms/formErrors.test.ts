import { describe, expect, it } from "vitest";
import { zodResolver } from "@hookform/resolvers/zod";
import { createProductSchema } from "@/features/products/schema/products";
import { collectFormErrorMessages } from "./formErrors";

/**
 * The save-blocked notice next to every disabled Save button is built from
 * these messages. When the collector comes back empty the button goes dead
 * with no explanation, which is indistinguishable from a broken form - so the
 * shapes react-hook-form actually produces are pinned here rather than assumed.
 */
describe("collectFormErrorMessages", () => {
  const resolve = async (values: Record<string, unknown>) => {
    const result = await zodResolver(createProductSchema)(
      values as never,
      undefined,
      { fields: {}, shouldUseNativeValidation: false } as never,
    );
    return (result as { errors: Record<string, unknown> }).errors;
  };

  it("finds the message behind a single invalid field", async () => {
    const errors = await resolve({ title: "t", description: "d", price: -5 });
    expect(Object.keys(errors)).toEqual(["price"]);
    expect(collectFormErrorMessages(errors)).toHaveLength(1);
    expect(collectFormErrorMessages(errors)[0]).toBeTruthy();
  });

  it("finds one message per invalid field", async () => {
    const errors = await resolve({ price: -5 });
    expect(Object.keys(errors).length).toBeGreaterThan(1);
    expect(collectFormErrorMessages(errors).length).toBe(Object.keys(errors).length);
  });

  it("returns nothing for a valid form, so the notice stays hidden", async () => {
    const errors = await resolve({ title: "t", description: "d", price: 10 });
    expect(errors).toEqual({});
    expect(collectFormErrorMessages(errors)).toEqual([]);
  });

  it("reaches messages nested under arrays (variants)", () => {
    const errors = {
      variants: [undefined, { sku: { type: "too_small", message: "SKU required" } }],
    };
    expect(collectFormErrorMessages(errors)).toEqual(["SKU required"]);
  });
});
