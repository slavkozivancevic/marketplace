import { env } from "@/env/server";

type JsonLdValue =
  | string
  | number
  | boolean
  | null
  | JsonLdValue[]
  | { [key: string]: JsonLdValue | undefined };

/**
 * Strips `undefined` recursively. Schema.org/JSON-LD readers tolerate
 * missing keys but explicit `"x": null` poisons Google's structured data
 * checker, so we remove anything we don't have a value for.
 */
function compact<T extends JsonLdValue>(value: T): T {
  if (Array.isArray(value)) {
    return value
      .map((v) => compact(v as JsonLdValue))
      .filter((v) => v !== undefined && v !== null) as T;
  }
  if (value && typeof value === "object") {
    const out: { [key: string]: JsonLdValue } = {};
    for (const [k, v] of Object.entries(value as Record<string, JsonLdValue | undefined>)) {
      if (v === undefined || v === null) continue;
      const compacted = compact(v);
      // Drop empty arrays / empty objects too - they add noise.
      if (Array.isArray(compacted) && compacted.length === 0) continue;
      if (
        typeof compacted === "object" &&
        !Array.isArray(compacted) &&
        Object.keys(compacted).length === 0
      )
        continue;
      out[k] = compacted;
    }
    return out as T;
  }
  return value;
}

/**
 * Builds an absolute URL from a path, honoring APP_URL config so we can
 * still emit the right schema in preview deployments.
 */
export function absoluteUrl(pathname: string): string {
  const base = env.APP_URL.replace(/\/$/, "");
  return pathname.startsWith("http") ? pathname : `${base}${pathname}`;
}

/**
 * Inline-script JSON for a single schema.org object. Returns the JSON
 * string ready to drop into a `<script type="application/ld+json">`.
 */
export function renderJsonLd(value: object): string {
  // Sanitize: prevent `</script>` injection inside the JSON payload.
  return JSON.stringify(compact(value as JsonLdValue)).replace(/</g, "\\u003c");
}

type Offer = {
  url: string;
  price: number;
  priceCurrency: string;
  availability: "InStock" | "OutOfStock" | "PreOrder";
};

/** Shipping cost for the offer (smallest currency unit). Powers Google's
 *  `shippingDetails`. `rate` 0 renders as free shipping. */
type ShippingPolicy = {
  rate: number;
  currency: string;
  /** Destination country (ISO 3166-1 alpha-2). */
  country: string;
};

/** Return policy for the offer. Powers Google's `hasMerchantReturnPolicy`. */
type ReturnPolicy = {
  /** Applicable country (ISO 3166-1 alpha-2). */
  country: string;
  /** Return window in days. */
  days: number;
  /** Who bears return shipping. Defaults to the customer (ReturnShippingFees). */
  free?: boolean;
};

type ProductSchemaInput = {
  name: string;
  description?: string | null;
  image: string[];
  sku?: string | null;
  url: string;
  brand?: string | null;
  offers: Offer | Offer[];
  aggregateRating?: { ratingValue: number; reviewCount: number } | null;
  /** Optional merchant listing fields, applied to every offer. */
  shipping?: ShippingPolicy;
  returnPolicy?: ReturnPolicy;
};

function shippingDetailsLd(shipping: ShippingPolicy) {
  return {
    "@type": "OfferShippingDetails",
    shippingRate: {
      "@type": "MonetaryAmount",
      value: (shipping.rate / 100).toFixed(2),
      currency: shipping.currency.toUpperCase(),
    },
    shippingDestination: {
      "@type": "DefinedRegion",
      addressCountry: shipping.country,
    },
  };
}

function returnPolicyLd(rp: ReturnPolicy) {
  return {
    "@type": "MerchantReturnPolicy",
    applicableCountry: rp.country,
    returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
    merchantReturnDays: rp.days,
    returnMethod: "https://schema.org/ReturnByMail",
    returnFees: rp.free
      ? "https://schema.org/FreeReturn"
      : "https://schema.org/ReturnShippingFees",
  };
}

/** Builds the schema.org `Product` JSON-LD object. */
export function productJsonLd(input: ProductSchemaInput) {
  const shippingDetails = input.shipping ? shippingDetailsLd(input.shipping) : undefined;
  const hasMerchantReturnPolicy = input.returnPolicy
    ? returnPolicyLd(input.returnPolicy)
    : undefined;

  const buildOffer = (o: Offer) => ({
    "@type": "Offer",
    url: o.url,
    price: (o.price / 100).toFixed(2),
    priceCurrency: o.priceCurrency.toUpperCase(),
    availability: `https://schema.org/${o.availability}`,
    shippingDetails,
    hasMerchantReturnPolicy,
  });

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: input.name,
    description: input.description,
    image: input.image,
    sku: input.sku,
    url: input.url,
    brand: input.brand ? { "@type": "Brand", name: input.brand } : undefined,
    offers: Array.isArray(input.offers)
      ? input.offers.map(buildOffer)
      : buildOffer(input.offers),
    aggregateRating: input.aggregateRating
      ? {
          "@type": "AggregateRating",
          ratingValue: input.aggregateRating.ratingValue.toFixed(1),
          reviewCount: input.aggregateRating.reviewCount,
        }
      : undefined,
  };
}

/** Builds a `BreadcrumbList` JSON-LD object from `[ [name, url], ... ]`. */
export function breadcrumbJsonLd(items: { name: string; url: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

/** Builds the site-wide `WebSite` schema (with optional SearchAction). */
export function websiteJsonLd(input: { name: string; url: string; searchUrl?: string }) {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: input.name,
    url: input.url,
    potentialAction: input.searchUrl
      ? {
          "@type": "SearchAction",
          target: {
            "@type": "EntryPoint",
            urlTemplate: `${input.searchUrl}{search_term_string}`,
          },
          "query-input": "required name=search_term_string",
        }
      : undefined,
  };
}

/** Builds an `Organization` schema for the marketplace. */
export function organizationJsonLd(input: { name: string; url: string; logoUrl?: string }) {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: input.name,
    url: input.url,
    logo: input.logoUrl,
  };
}
