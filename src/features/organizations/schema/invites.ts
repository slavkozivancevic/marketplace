import { z } from "zod";
import { INVITABLE_ROLES } from "@/types/types";

export const sendInviteSchema = z.object({
  email: z.email("Valid email is required"),
  role: z.enum(INVITABLE_ROLES),
});

export type SendInviteInput = z.infer<typeof sendInviteSchema>;
