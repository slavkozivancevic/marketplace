"use server";

import { cookies } from "next/headers";
import { VALID_CURRENCIES } from "@/lib/currency-config";
import type { Currency } from "@/lib/currency-config";

export async function setCurrency(currency: string) {
  const valid: Currency = VALID_CURRENCIES.includes(currency as Currency)
    ? (currency as Currency)
    : "usd";
  const cookieStore = await cookies();
  cookieStore.set("NEXT_CURRENCY", valid, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
}