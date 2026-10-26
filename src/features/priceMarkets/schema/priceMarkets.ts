import { z } from "zod";
import { normalizeCountryCode } from "@/lib/i18n/countries";

/** Longest market name the form accepts - it sits in a select and a table cell. */
export const PRICE_MARKET_NAME_MAX_LENGTH = 60;

// Locale-keyed translations map, same shape as tags and trust points. The
// default locale uses the canonical `name` field and never appears here.
const translationsSchema = z
  .record(
    z.string(),
    z.object({ name: z.string().max(PRICE_MARKET_NAME_MAX_LENGTH).optional() }).optional(),
  )
  .nullable()
  .optional();

export const priceMarketSchema = z.object({
  name: z.string().trim().min(1).max(PRICE_MARKET_NAME_MAX_LENGTH),
  translations: translationsSchema,
  // ISO alpha-2 codes. Whether another market already owns one is a database
  // question, answered by the db layer; this only refuses codes nobody knows.
  countries: z
    .array(z.string())
    // A comparison, not the `isCountryCode` guard: a guard (even wrapped in a
    // lambda, which TypeScript infers as a guard too) narrows the output type,
    // and the form's resolver would no longer match its values.
    .refine((codes) => codes.every((c) => normalizeCountryCode(c) === c), { params: { i18n: "invalid" } })
    .refine((codes) => new Set(codes).size === codes.length, { params: { i18n: "invalid" } }),
});

export type PriceMarketInput = z.infer<typeof priceMarketSchema>;
