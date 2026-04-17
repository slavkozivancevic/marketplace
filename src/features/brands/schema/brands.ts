import { z } from "zod";

export const createBrandSchema = z.object({
  name: z.string().min(1, "Brand name is required").max(100, "Brand name is too long"),
  slug: z.string().optional(),
  logoUrl: z.string().url("Logo URL must be a valid URL").optional().or(z.literal("")),
  description: z.string().max(1000, "Description is too long").optional(),
});

export const updateBrandSchema = createBrandSchema;

export type CreateBrandInput = z.infer<typeof createBrandSchema>;
export type UpdateBrandInput = z.infer<typeof updateBrandSchema>;