"use server";

import { cookies } from "next/headers";

export async function setLocale(locale: string) {
  const valid = ["en", "sr"].includes(locale) ? locale : "en";
  const cookieStore = await cookies();
  cookieStore.set("NEXT_LOCALE", valid, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
}
