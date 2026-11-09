import { QueryClient, defaultShouldDehydrateQuery } from "@tanstack/react-query";
import { isOrgChangedError } from "@/features/organizations/orgScope";

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
        gcTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
        // One retry, except for ORG_CHANGED: retrying with the same stale org
        // only earns another 409 while the shell is already re-rendering on
        // the right org (see orgScope.ts).
        retry: (failureCount, error) =>
          !isOrgChangedError(error) && failureCount < 1,
      },
      dehydrate: {
        // Allow dehydrating in-flight queries so SSR-prefetched data
        // streams to the client even if the prefetch hasn't fully resolved.
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) ||
          query.state.status === "pending",
      },
    },
  });
}
