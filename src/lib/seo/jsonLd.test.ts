import { describe, it, expect, vi } from "vitest";

// jsonLd.ts imports the validated server env at module load; stub it so the
// unit test doesn't need the full runtime environment.
vi.mock("@/env/server", () => ({ env: { APP_URL: "https://shop.test" } }));

const { productJsonLd, breadcrumbJsonLd, renderJsonLd } = await import("./jsonLd");

const baseInput = {
  name: "Running Jacket",
  image: ["https://shop.test/a.jpg"],
  url: "https://shop.test/en/products/running-jacket",
  offers: {
    url: "https://shop.test/en/products/running-jacket",
    price: 2999,
    priceCurrency: "usd" as const,
    availability: "InStock" as const,
  },
};

describe("productJsonLd", () => {
  it("builds a Product with a formatted, currency-normalized offer", () => {
    const schema = productJsonLd(baseInput);
    expect(schema["@type"]).toBe("Product");
    const offer = schema.offers as unknown as Record<string, unknown>;
    expect(offer.price).toBe("29.99");
    expect(offer.priceCurrency).toBe("USD");
    expect(offer.availability).toBe("https://schema.org/InStock");
  });

  it("emits shippingDetails when shipping is provided", () => {
    const schema = productJsonLd({
      ...baseInput,
      shipping: { rate: 500, currency: "usd", country: "US" },
    });
    const offer = schema.offers as unknown as Record<string, Record<string, unknown>>;
    expect(offer.shippingDetails.shippingRate).toMatchObject({
      value: "5.00",
      currency: "USD",
    });
  });

  it("emits hasMerchantReturnPolicy when a return policy is provided", () => {
    const schema = productJsonLd({
      ...baseInput,
      returnPolicy: { country: "US", days: 30 },
    });
    const offer = schema.offers as unknown as Record<string, Record<string, unknown>>;
    expect(offer.hasMerchantReturnPolicy.merchantReturnDays).toBe(30);
  });

  it("omits merchant fields when not provided", () => {
    const schema = productJsonLd(baseInput);
    const offer = schema.offers as unknown as Record<string, unknown>;
    expect(offer.shippingDetails).toBeUndefined();
    expect(offer.hasMerchantReturnPolicy).toBeUndefined();
  });
});

describe("renderJsonLd", () => {
  it("strips undefined fields so the payload has no empty keys", () => {
    const json = renderJsonLd(productJsonLd(baseInput));
    const parsed = JSON.parse(json) as { aggregateRating?: unknown };
    expect("aggregateRating" in parsed).toBe(false);
  });

  it("escapes < to prevent script injection", () => {
    const json = renderJsonLd({ name: "</script>" });
    expect(json).not.toContain("</script>");
    expect(json).toContain("\\u003c");
  });
});

describe("breadcrumbJsonLd", () => {
  it("numbers list items from 1", () => {
    const schema = breadcrumbJsonLd([
      { name: "Home", url: "https://shop.test/" },
      { name: "Products", url: "https://shop.test/products" },
    ]);
    expect(schema.itemListElement.map((i) => i.position)).toEqual([1, 2]);
  });
});
