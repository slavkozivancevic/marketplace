"use client";

import { useQuery } from "@tanstack/react-query";
import { getUserProfiles } from "../actions/userProfiles";
import type { UserProfile } from "../db/userProfiles";

export type { UserProfile };

export function useUserProfiles(ids: string[]) {
  const uniqueIds = [...new Set(ids)].filter(Boolean).sort();

  return useQuery({
    queryKey: ["user-profiles", uniqueIds.join(",")],
    queryFn: () => getUserProfiles(uniqueIds),
    enabled: uniqueIds.length > 0,
    staleTime: 1000 * 60 * 5,
  });
}