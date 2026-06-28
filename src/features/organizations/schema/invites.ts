import { z } from "zod";
import { INVITABLE_ROLES } from "@/types/types";

export const sendInviteSchema = z.object({
  email: z.email(),
  role: z.enum(INVITABLE_ROLES),
});

export type SendInviteInput = z.infer<typeof sendInviteSchema>;

/**
 * Client-form variant of {@link sendInviteSchema}. An empty email validates as
 * OK so a cleared field renders neutral instead of staying red on "invalid" -
 * Zod v4 flattens this union back to the email-format issue, so a *non-empty*
 * invalid address still gets the localized "invalid email" message. Submit is
 * gated on a non-empty value in the form; the strict schema above still guards
 * the server action, so empty can never actually be sent.
 */
export const sendInviteFormSchema = z.object({
  email: z.email().or(z.literal("")),
  role: z.enum(INVITABLE_ROLES),
});
