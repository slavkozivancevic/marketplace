"use client";

import { useQuery } from "@tanstack/react-query";
import axios from "axios";

/**
 * A short-lived read URL for a chat attachment. Shared by the bubble's own
 * attachments and the thumbnail in a quote of one, so both read the same
 * cache entry.
 */
export function useAttachmentReadUrl(key: string, enabled = true) {
  return useQuery({
    queryKey: ["chat-attachment-url", key],
    queryFn: async () => {
      const { data } = await axios.get<{ url: string }>(
        `/api/chat/attachments/read-url?key=${encodeURIComponent(key)}`,
      );
      return data.url;
    },
    enabled,
    staleTime: 1000 * 60 * 50, // 50 min - presigned URL expires at 60 min (buffer of 10 min)
    retry: 1,
  });
}
