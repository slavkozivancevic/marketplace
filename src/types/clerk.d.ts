import { UserRole } from "@/generated/prisma/client";

declare global {
  interface CustomJwtSessionClaims {
    dbId?: string;
    role?: UserRole;
    activeOrgId?: string;
  }

  interface UserPublicMetadata {
    dbId?: string;
    role?: UserRole;
    activeOrgId?: string;
  }
}

export {};
