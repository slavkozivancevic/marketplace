"use client";

import Link from "next/link";
import {
  SignedIn,
  SignedOut,
  SignInButton,
  SignUpButton,
  UserButton,
} from "@clerk/nextjs";

export function PublicHeader() {
  return (
    <header className="flex h-16 items-center justify-between border-b px-6">
      <Link href="/" className="text-lg font-semibold">
        Marketplace
      </Link>

      <div className="flex items-center gap-4">
        <SignedOut>
          <SignInButton mode="redirect" />
          <SignUpButton mode="redirect">
            <button className="rounded-md bg-black px-4 py-2 text-sm text-white">
              Sign up
            </button>
          </SignUpButton>
        </SignedOut>

        <SignedIn>
          <Link href="/dashboard" className="text-sm">
            Dashboard
          </Link>
          <UserButton />
        </SignedIn>
      </div>
    </header>
  );
}
