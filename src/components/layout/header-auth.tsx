"use client";

import Link from "next/link";
import {
  SignedIn,
  SignedOut,
  SignInButton,
  SignUpButton,
  UserButton,
} from "@clerk/nextjs";
import { Button } from "@/components/ui/button";

interface HeaderAuthProps {
  mode?: "modal" | "redirect";
  showDashboardLink?: boolean;
}

export function HeaderAuth({
  mode = "modal",
  showDashboardLink = false,
}: HeaderAuthProps) {
  return (
    <div className="flex items-center gap-4">
      <SignedOut>
        <SignInButton mode={mode}>
          <Button variant="outline">Sign In</Button>
        </SignInButton>
        <SignUpButton mode={mode}>
          <Button>Sign up</Button>
        </SignUpButton>
      </SignedOut>

      <SignedIn>
        {showDashboardLink && (
          <Link href="/dashboard" className="text-sm">
            Dashboard
          </Link>
        )}
        <UserButton />
      </SignedIn>
    </div>
  );
}
