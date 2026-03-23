import { z } from "zod";

export const UserRoleEnum = z.enum(["USER", "ADMIN", "SELLER"]);

export const updateUserRoleSchema = z.object({
  role: UserRoleEnum,
});

export type UpdateUserRoleInput = z.infer<typeof updateUserRoleSchema>;
export type UserRole = z.infer<typeof UserRoleEnum>;