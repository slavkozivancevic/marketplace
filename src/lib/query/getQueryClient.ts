import { cache } from "react";
import { makeQueryClient } from "./queryClient";

/**
 * Per-request QueryClient for server components.
 * `cache()` ensures all server components within a single request
 * share the same QueryClient instance, so prefetches are deduped.
 */
export const getQueryClient = cache(makeQueryClient);
