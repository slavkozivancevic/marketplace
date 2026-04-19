"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { getWishlistIds, toggleWishlist } from "../actions/wishlist";

export const WISHLIST_IDS_KEY = ["wishlist", "ids"] as const;

export function useIsWishlisted(productId: string): boolean {
  const { userId } = useAuth();

  const { data } = useQuery({
    queryKey: WISHLIST_IDS_KEY,
    queryFn: getWishlistIds,
    enabled: !!userId,
    staleTime: Infinity,
    select: (ids) => ids.includes(productId),
  });

  return data ?? false;
}

export function useWishlistCount(): number {
  const { userId } = useAuth();

  const { data } = useQuery({
    queryKey: WISHLIST_IDS_KEY,
    queryFn: getWishlistIds,
    enabled: !!userId,
    staleTime: Infinity,
    select: (ids) => ids.length,
  });

  return data ?? 0;
}

export function useWishlistToggle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (productId: string) => {
      const result = await toggleWishlist(productId);
      if ("error" in result) throw new Error(result.error);
      return result;
    },
    onMutate: async (productId) => {
      // Cancel any in-flight fetches so they don't overwrite the optimistic update
      await queryClient.cancelQueries({ queryKey: WISHLIST_IDS_KEY });

      const previousIds = queryClient.getQueryData<string[]>(WISHLIST_IDS_KEY);

      queryClient.setQueryData<string[]>(WISHLIST_IDS_KEY, (old = []) =>
        old.includes(productId)
          ? old.filter((id) => id !== productId)
          : [...old, productId],
      );

      return { previousIds };
    },
    onError: (_err, _productId, context) => {
      if (context?.previousIds !== undefined) {
        queryClient.setQueryData(WISHLIST_IDS_KEY, context.previousIds);
      }
    },
  });
}