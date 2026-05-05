"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("auth");

  return (
    <div className="flex items-center gap-4">
      <SignedOut>
        <SignInButton mode={mode}>
          <Button variant="outline">{t("signIn")}</Button>
        </SignInButton>
        <SignUpButton mode={mode}>
          <Button>{t("signUp")}</Button>
        </SignUpButton>
      </SignedOut>

      <SignedIn>
        {showDashboardLink && (
          <Link href="/dashboard" className="text-sm">
            {t("dashboard")}
          </Link>
        )}
        <UserButton />
      </SignedIn>
    </div>
  );
}
