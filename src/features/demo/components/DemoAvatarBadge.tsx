"use client";

import { useUser } from "@clerk/nextjs";
import { useTranslations } from "next-intl";
import { DEMO_ACCOUNTS, demoRoleOfEmail } from "../demoAccounts";

/**
 * A small "Demo" tag over the avatar while a public demo account is signed in,
 * so a visitor always knows which account they are in and why a save of the
 * seller or the admin does nothing.
 *
 * Absolutely positioned inside the avatar slot: it appears once Clerk knows the
 * user without moving anything in the header. `pointer-events-none`, so the
 * avatar under it still opens the account menu. Screen readers get the full
 * sentence.
 */
export function DemoAvatarBadge() {
  const t = useTranslations("demo");
  const { user } = useUser();
  const role = demoRoleOfEmail(user?.primaryEmailAddress?.emailAddress);
  if (!role) return null;

  return (
    <span className="pointer-events-none absolute -bottom-1.5 left-1/2 -translate-x-1/2 rounded-full bg-primary px-1.5 text-[0.5625rem] leading-3.5 font-semibold tracking-wide text-primary-foreground uppercase shadow-sm">
      <span aria-hidden>{t("badge")}</span>
      <span className="sr-only">
        {DEMO_ACCOUNTS[role].readOnly ? t("badgeReadOnly") : t("badgeBuyer")}
      </span>
    </span>
  );
}
