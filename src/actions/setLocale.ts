"use server";

import { cookies } from "next/headers";
import { asLocale } from "@/i18n/config";

export async function setLocale(locale: string) {
  const valid = asLocale(locale);
  const cookieStore = await cookies();
  cookieStore.set("NEXT_LOCALE", valid, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
}
