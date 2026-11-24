import { z } from "zod/v4";
import { isCountryCode } from "@/lib/i18n/countries";

/**
 * The cash-on-delivery shipping form.
 *
 * Messages come from the localized Zod error map (`useZodResolver`), so no
 * field carries an inline string.
 */
export const shippingSchema = z.object({
  name: z.string().trim().min(2),
  line1: z.string().trim().min(3),
  line2: z.string().optional(),
  city: z.string().trim().min(1),
  state: z.string().optional(),
  postalCode: z.string().trim().min(1),
  // An ISO code from the picker, the same shape Stripe stores for a card
  // order - never free text a courier has to decipher.
  // `min(1)` first: an untouched picker is a missing required field and says
  // so, like every other one, instead of the "Invalid value" the code check
  // alone gave it. The resolver shows the first issue, so the code check only
  // speaks for a non-empty value that is not a country.
  // A plain boolean, not the type guard: a guard (including one TypeScript
  // infers from an arrow) narrows the schema's output to CountryCode and the
  // form's input type stops matching.
  country: z
    .string()
    .min(1)
    .refine((v): boolean => isCountryCode(v)),
});

export type ShippingForm = z.infer<typeof shippingSchema>;
