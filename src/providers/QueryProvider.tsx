"use client";

import {
  QueryClient,
  QueryClientProvider,
  environmentManager,
} from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { makeQueryClient } from "@/lib/query/queryClient";

let browserQueryClient: QueryClient | undefined;

function getBrowserQueryClient() {
  // Server: always make a fresh client (no sharing across requests).
  if (environmentManager.isServer()) return makeQueryClient();
  // Browser: reuse a singleton across React renders/StrictMode mounts.
  if (!browserQueryClient) browserQueryClient = makeQueryClient();
  return browserQueryClient;
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const queryClient = getBrowserQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {process.env.NODE_ENV === "development" && (
        <ReactQueryDevtools
          initialIsOpen={false}
          buttonPosition="bottom-left"
        />
      )}
    </QueryClientProvider>
  );
}
