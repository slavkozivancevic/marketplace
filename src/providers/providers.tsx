"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { ThemeProvider } from "next-themes";
import { NuqsAdapter } from "nuqs/adapters/next";
import { Suspense } from "react";
import { Toaster } from "@/components/ui/sonner";
import { QueryProvider } from "./QueryProvider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ChatDrawerRoot } from "@/features/chat/components/ChatDrawer";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={null}>
      <ClerkProvider>
        <NuqsAdapter>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            themes={["light", "dark", "cosmos", "system"]}
          >
            <QueryProvider>
              <TooltipProvider>{children}</TooltipProvider>
              <Toaster />
              <ChatDrawerRoot />
            </QueryProvider>
          </ThemeProvider>
        </NuqsAdapter>
      </ClerkProvider>
    </Suspense>
  );
}
