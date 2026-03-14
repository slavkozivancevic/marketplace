"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { Suspense } from "react";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={null}>
      <ClerkProvider>{children}</ClerkProvider>
    </Suspense>
  );
}
