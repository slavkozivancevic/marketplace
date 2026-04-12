"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { ThemeProvider } from "next-themes";
import { Suspense } from "react";
import { Toaster } from "@/components/ui/sonner";
import { QueryProvider } from "./QueryProvider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={null}>
      <ClerkProvider>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <QueryProvider>
            {children}
            <Toaster />
          </QueryProvider>
        </ThemeProvider>
      </ClerkProvider>
    </Suspense>
  );
}
