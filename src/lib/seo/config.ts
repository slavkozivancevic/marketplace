/**
 * Defaults for the merchant-listing structured data (shipping + return policy)
 * that Google Search Console asks for on product pages. Centralized so the
 * policy advertised in JSON-LD stays consistent and is easy to tune.
 *
 * The country is ISO 3166-1 alpha-2 and is aligned with the USD offer pricing
 * the storefront emits (the Product JSON-LD prices offers in USD).
 */
export const SEO_MERCHANT_POLICY = {
  /** Applicable / shipping-destination country for structured data. */
  country: "US",
} as const;

/* The return window used to live here as a flat 30 days. It is now
 * `Organization.returnWindowDays` - per seller, editable by them, and enforced
 * by `createReturn` - so the product page reads it from the row rather than
 * advertising a platform number no seller had agreed to. */
