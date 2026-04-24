"use client";

import { useQuery } from "@tanstack/react-query";

export interface UserProfile {
  name: string | null;
  imageUrl: string | null;
}

export function useUserProfiles(ids: string[]) {
  const uniqueIds = [...new Set(ids)].filter(Boolean).sort();

  return useQuery({
    queryKey: ["user-profiles", uniqueIds.join(",")],
    queryFn: async (): Promise<Record<string, UserProfile>> => {
      if (uniqueIds.length === 0) return {};
      const res = await fetch(`/api/chat/user-profiles?ids=${uniqueIds.join(",")}`);
      if (!res.ok) throw new Error("Failed to fetch user profiles");
      return res.json() as Promise<Record<string, UserProfile>>;
    },
    enabled: uniqueIds.length > 0,
    staleTime: 1000 * 60 * 5,
  });
}