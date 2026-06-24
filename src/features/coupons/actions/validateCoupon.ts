"use server";

import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { validateCoupon, cartSubtotalUsd, type CartItemRef } from "../db/coupons";
import { getCurrencyRate } from "@/features/currency/db/currencyRates";
import { convertCents, formatPrice } from "@/lib/currency";
import { VALID_CURRENCIES, type Currency } from "@/lib/currency-config";

export type ValidateCouponResult =
  | { ok: true; code: string; discount: number; currency: string }
  | { ok: false; message: string };

/**
 * Cart-side coupon check: recomputes the subtotal from the DB, validates the
 * code and returns the discount in the buyer's display currency. The real
 * redemption is re-validated and applied server-side at checkout.
 */
export async function validateCouponAction(
  code: string,
  items: CartItemRef[],
): Promise<ValidateCouponResult> {
  const t = await getTranslations("coupons");
  if (items.length === 0) return { ok: false, message: t("errors.cartEmpty") };

  const cookieStore = await cookies();
  const raw = cookieStore.get("NEXT_CURRENCY")?.value ?? "usd";
  const currency: Currency = VALID_CURRENCIES.includes(raw as Currency) ? (raw as Currency) : "usd";
  const rate = await getCurrencyRate(currency);

  const subtotalUsd = await cartSubtotalUsd(items);
  const res = await validateCoupon(code, subtotalUsd);
  if (!res.ok) {
    const message =
      res.reason === "minOrder"
        ? t("errors.minOrder", {
            amount: formatPrice(convertCents(res.minOrder ?? 0, currency, rate), currency),
          })
        : t(`errors.${res.reason}`);
    return { ok: false, message };
  }

  return {
    ok: true,
    code: res.code,
    discount: convertCents(res.discountUsd, currency, rate),
    currency,
  };
}
