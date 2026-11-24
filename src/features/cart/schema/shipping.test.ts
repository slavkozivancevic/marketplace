import { describe, it, expect } from "vitest";
import { shippingSchema } from "./shipping";
import { createZodErrorMap } from "@/i18n/zodErrorMap";

// The translator returns the message KEY, so the test reads which message the
// buyer would see in any locale.
const error = createZodErrorMap((key) => key);

const valid = {
  name: "Test Buyer",
  line1: "Ulica Primera 12",
  city: "Demograd",
  postalCode: "00000",
  country: "RS",
};

/** The first message on a field - the one the form shows. */
function firstMessage(input: Record<string, unknown>, field: string) {
  const res = shippingSchema.safeParse(input, { error });
  if (res.success) return null;
  return res.error.issues.find((i) => i.path[0] === field)?.message ?? null;
}

describe("shippingSchema - country", () => {
  it("accepts an ISO country code", () => {
    expect(shippingSchema.safeParse(valid).success).toBe(true);
  });

  it("calls an untouched country picker required, like every other required field", () => {
    expect(firstMessage({ ...valid, country: "" }, "country")).toBe("required");
    expect(firstMessage({ ...valid, city: "" }, "city")).toBe("required");
  });

  it("calls a non-empty value that is not a country invalid", () => {
    expect(firstMessage({ ...valid, country: "Serbia" }, "country")).toBe("custom");
  });
});
