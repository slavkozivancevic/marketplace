"use server";

import { auth } from "@clerk/nextjs/server";
import { getUserProfilesById, UserProfile } from "../db/userProfiles";

export async function getUserProfiles(
  ids: string[]
): Promise<Record<string, UserProfile>> {
  const { userId } = await auth();
  if (!userId || ids.length === 0) return {};
  return getUserProfilesById(ids);
}