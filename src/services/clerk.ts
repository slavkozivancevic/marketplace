import { clerkClient } from "@clerk/nextjs/server";
import { UserRole } from "@/generated/prisma/client";

export async function syncClerkUserMetadata({
  clerkUserId,
  dbId,
  role,
  activeOrgId,
}: {
  clerkUserId: string;
  dbId: string;
  role: UserRole;
  activeOrgId: string;
}) {
  if (!activeOrgId) {
    throw new Error("activeOrgId is required for Clerk metadata sync");
  }

  try {
    const client = await clerkClient();

    return await client.users.updateUserMetadata(clerkUserId, {
      publicMetadata: {
        dbId,
        role,
        activeOrgId,
      },
    });
  } catch (error) {
    console.error("Clerk metadata update failed:", error);
    throw error;
  }
}
