"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useForm } from "react-hook-form";
import { useZodResolver } from "@/i18n/useZodResolver";
import { z } from "zod/v4";
import { useRouter } from "@/i18n/navigation";
import { useTranslations, useLocale } from "next-intl";
import { CreditCard, Truck, ShoppingBag, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/sonner";
import { useInvalidToast } from "@/lib/forms/useInvalidToast";
import { useCartStore } from "../store/cartStore";
import { COUPON_STORAGE_KEY } from "../utils/couponStorage";
import { localizedVariantLabel, pickLocalized } from "../utils/variantOptions";
import { useCurrencyStore } from "@/store/currency";
import { formatPrice, convertCents } from "@/lib/currency";
import { createCheckoutSession } from "../actions/checkout";
import { createCodCheckout } from "../actions/codCheckout";
import { validateCouponAction } from "@/features/coupons/actions/validateCoupon";
import { getCartShippingAction } from "@/features/shipping/actions/shipping";
import type { OrgShippingLine } from "@/features/shipping/db/shipping";
import { Link } from "@/i18n/navigation";

type PaymentMethod = "card" | "cod";

const shippingSchema = z.object({
  name: z.string().min(2),
  line1: z.string().min(3),
  line2: z.string().optional(),
  city: z.string().min(1),
  state: z.string().optional(),
  postalCode: z.string().min(1),
  country: z.string().min(2),
});

type ShippingForm = z.infer<typeof shippingSchema>;

export function CheckoutPage() {
  const t = useTranslations("checkout");
  const onInvalid = useInvalidToast();
  const locale = useLocale();
  const router = useRouter();
  const { items, totalPrice } = useCartStore();
  const { currency, currentRate } = useCurrencyStore();
  const codAvailable = items.every((i) => i.requiresShipping);
  const [method, setMethod] = useState<PaymentMethod>("card");
  const [isPending, startTransition] = useTransition();
  // Applied coupon (discount is in the display currency, from the server check).
  const [couponInput, setCouponInput] = useState("");
  const [applied, setApplied] = useState<{ code: string; discount: number } | null>(null);
  const [couponBusy, setCouponBusy] = useState(false);
  // Read the persisted code synchronously at first render, before the sync
  // effect below can clear the key on mount (applied starts null).
  const storedCouponCode = useRef<string | null | undefined>(undefined);
  if (storedCouponCode.current === undefined) {
    storedCouponCode.current =
      typeof window !== "undefined" ? sessionStorage.getItem(COUPON_STORAGE_KEY) : null;
  }
  // Latches once the Stripe redirect is kicked off and never resets: the
  // browser takes a moment to leave the page after setting location.href, and
  // without this the transition ends first and the button flashes back to its
  // idle state before the navigation visibly happens.
  const [isRedirecting, setIsRedirecting] = useState(false);
  // Returning via browser Back from Stripe restores this page from the bfcache,
  // which resumes the exact JS state - so the latch above would stay stuck on
  // and spin the button forever. `pageshow` with `persisted` fires only on a
  // bfcache restore; release the latch there.
  useEffect(() => {
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) setIsRedirecting(false);
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);
  // Track persist rehydration so we can tell "store not loaded yet" (show
  // nothing, avoids the empty-cart flash on back-nav from Stripe) apart from
  // "cart genuinely empty" (show the empty state, e.g. after clearing the cart).
  // Start false: reading `useCartStore.persist` during render crashes on the
  // server (e.g. a full document load when returning via the browser's Back
  // button from Stripe), where the persist API isn't available. The real
  // hydration state is read in the effect below, which only runs on the client.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    // Sync once at mount in case hydration finished before this ran, then
    // subscribe for the completion event.
    setHydrated(useCartStore.persist.hasHydrated());
    return useCartStore.persist.onFinishHydration(() => setHydrated(true));
  }, []);

  // An applied coupon was validated against a specific cart, and its discount
  // (percentage, min-order eligibility, ...) depends on the subtotal. When the
  // cart changes (e.g. quantities tweaked from the side drawer) re-validate the
  // same code against the new cart and refresh the discount instead of dropping
  // it; only remove it if it's no longer valid (e.g. now below the min order).
  // A ref holds the current code so re-applying doesn't re-trigger this effect.
  const appliedRef = useRef(applied);
  appliedRef.current = applied;
  const itemsSig = items.map((i) => `${i.productId}:${i.variantId}:${i.quantity}`).join("|");
  useEffect(() => {
    const current = appliedRef.current;
    if (!current) return;
    let active = true;
    const refs = items.map((i) => ({ productId: i.productId, variantId: i.variantId, quantity: i.quantity }));
    validateCouponAction(current.code, refs)
      .then((res) => {
        if (!active) return;
        if (res.ok) {
          setApplied({ code: res.code, discount: res.discount });
        } else {
          setApplied(null);
          toast.error(res.message);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemsSig]);

  // Restore a coupon persisted from a previous page load (e.g. returning via
  // browser Back from Stripe) once, re-validating it against the current cart.
  // Waits for the cart store to finish rehydrating from localStorage so the
  // re-validation runs against the real items, not the empty initial state.
  // Silent on failure - this isn't a user action, so no toast.
  const couponRestoredRef = useRef(false);
  useEffect(() => {
    if (couponRestoredRef.current || !hydrated) return;
    couponRestoredRef.current = true;
    const code = storedCouponCode.current;
    if (!code || items.length === 0) return;
    let active = true;
    const refs = items.map((i) => ({ productId: i.productId, variantId: i.variantId, quantity: i.quantity }));
    validateCouponAction(code, refs)
      .then((res) => {
        if (!active) return;
        if (res.ok) setApplied({ code: res.code, discount: res.discount });
        else sessionStorage.removeItem(COUPON_STORAGE_KEY);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  // Keep sessionStorage in sync with the applied coupon so it survives a reload.
  useEffect(() => {
    if (applied) sessionStorage.setItem(COUPON_STORAGE_KEY, applied.code);
    else sessionStorage.removeItem(COUPON_STORAGE_KEY);
  }, [applied]);

  // Reset the typed-but-not-applied coupon field on route change - the client
  // Router Cache (dynamicOnHover) can keep this page warm, so a stray code would
  // otherwise survive a back-navigation here. The applied coupon itself is
  // intentionally preserved (persisted above).
  const pathname = usePathname();
  useEffect(() => {
    setCouponInput("");
  }, [pathname]);

  // Per-seller delivery for the current cart (USD base; converted for display
  // like item prices). Recomputed whenever the cart changes.
  const [shipping, setShipping] = useState<{ lines: OrgShippingLine[]; totalUsd: number }>({
    lines: [],
    totalUsd: 0,
  });
  useEffect(() => {
    let active = true;
    const refs = items.map((i) => ({ productId: i.productId, variantId: i.variantId, quantity: i.quantity }));
    getCartShippingAction(refs)
      .then((res) => {
        if (!active) return;
        setShipping({ lines: res.lines, totalUsd: res.totalUsd });
        // Self-heal: the resolver flagged lines whose product/variant no longer
        // exists (e.g. the seller re-saved the product, regenerating variant
        // ids). Prune them so the displayed total, shipping, coupon eligibility
        // and checkout all agree on the real, purchasable cart - and tell the
        // buyer which items dropped. Pruning changes the cart, which re-runs the
        // dependent effects (coupon re-validation, this one) against the clean
        // cart; the next pass reports no unavailable lines, so it can't loop.
        if (res.unavailable.length > 0) {
          const { items: current, removeItem } = useCartStore.getState();
          for (const u of res.unavailable) {
            const stale = current.find(
              (i) => i.productId === u.productId && i.variantId === u.variantId,
            );
            removeItem(u.productId, u.variantId);
            toast.error(
              t("itemRemoved", {
                item: stale ? pickLocalized(stale.productTitleI18n, locale, stale.productTitle) : "",
              }),
            );
          }
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemsSig]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ShippingForm>({
    mode: "onTouched",
    resolver: useZodResolver(shippingSchema),
  });

  if (items.length === 0) {
    if (!hydrated) return null; // still rehydrating - avoid empty-cart flash
    return (
      <div className="flex flex-col items-center justify-center flex-1 gap-4 py-24 text-center">
        <ShoppingBag className="h-16 w-16 text-muted-foreground/40" />
        <h2 className="text-xl font-semibold">{t("emptyCart")}</h2>
        <p className="text-sm text-muted-foreground">{t("emptyCartDesc")}</p>
        <Button asChild className="mt-2">
          <Link href="/products">{t("continueShopping")}</Link>
        </Button>
      </div>
    );
  }

  const cartItems = () =>
    items.map((i) => ({ productId: i.productId, variantId: i.variantId, quantity: i.quantity }));

  const applyCoupon = async () => {
    const code = couponInput.trim();
    if (!code) return;
    setCouponBusy(true);
    const res = await validateCouponAction(code, cartItems());
    setCouponBusy(false);
    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    setApplied({ code: res.code, discount: res.discount });
    setCouponInput("");
  };

  const handleCardCheckout = () => {
    startTransition(async () => {
      const result = await createCheckoutSession(cartItems(), applied?.code);
      if ("error" in result) {
        toast.error(result.message);
        return;
      }
      // Stripe-hosted checkout - external URL. Bypass next-intl's typed
      // router (it only accepts registered pathnames) with a hard nav. Keep the
      // button in its loading state until the browser actually leaves the page.
      setIsRedirecting(true);
      window.location.href = result.url;
    });
  };

  const handleCodSubmit = (data: ShippingForm) => {
    startTransition(async () => {
      const result = await createCodCheckout(cartItems(), data, applied?.code);
      if ("error" in result) {
        toast.error(result.message);
        return;
      }
      router.push({
        pathname: "/checkout/success",
        query: { order_id: result.orderId },
      });
    });
  };

  return (
    <div className="flex-1 overflow-y-auto min-h-0">
      <div className="max-w-4xl mx-auto px-4 py-10 grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">

        {/* ── Left: order summary ────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShoppingBag className="h-4 w-4" />
              {t("orderSummaryLabel")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {items.map((item, i) => {
              const variantText = localizedVariantLabel(
                item.variantOptions,
                locale,
                item.variantLabel,
              );
              const title = pickLocalized(
                item.productTitleI18n,
                locale,
                item.productTitle,
              );
              return (
              <div key={`${item.productId}-${item.variantId}`}>
                {i > 0 && <Separator className="mb-3" />}
                <div className="flex gap-3 items-center text-sm">
                  <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded border">
                    {item.productImage ? (
                      <Image
                        src={item.productImage}
                        alt={title}
                        fill
                        sizes="56px"
                        className="object-cover"
                      />
                    ) : (
                      <div className="h-full w-full bg-muted" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{title}</p>
                    {variantText && (
                      <p className="text-xs text-muted-foreground">{variantText}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {formatPrice(convertCents(item.price, currency, currentRate()), currency)} × {item.quantity}
                    </p>
                  </div>
                  <p className="font-semibold shrink-0 ml-4">
                    {formatPrice(convertCents(item.price * item.quantity, currency, currentRate()), currency)}
                  </p>
                </div>
              </div>
              );
            })}
            <Separator />

            {/* Coupon */}
            {applied ? (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{t("couponApplied", { code: applied.code })}</span>
                <button
                  type="button"
                  onClick={() => setApplied(null)}
                  className="text-xs text-destructive hover:underline cursor-pointer"
                >
                  {t("removeCoupon")}
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Input
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value)}
                  placeholder={t("couponPlaceholder")}
                  className="h-9"
                  autoComplete="off"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 shrink-0"
                  disabled={couponBusy || !couponInput.trim()}
                  onClick={applyCoupon}
                >
                  {couponBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : t("applyCoupon")}
                </Button>
              </div>
            )}

            <Separator />

            {(() => {
              const subtotalCents = convertCents(totalPrice(), currency, currentRate());
              const shippingCents = convertCents(shipping.totalUsd, currency, currentRate());
              const discount = applied?.discount ?? 0;
              const grandTotal = Math.max(0, subtotalCents - discount) + shippingCents;
              if (!applied && shippingCents === 0) {
                return (
                  <div className="flex justify-between font-semibold text-sm">
                    <span>{t("total")}</span>
                    <span>{formatPrice(subtotalCents, currency)}</span>
                  </div>
                );
              }
              return (
                <div className="space-y-1.5">
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>{t("subtotal")}</span>
                    <span>{formatPrice(subtotalCents, currency)}</span>
                  </div>
                  {applied && (
                    <div className="flex justify-between text-sm text-emerald-600">
                      <span>{t("discount")}</span>
                      <span>-{formatPrice(applied.discount, currency)}</span>
                    </div>
                  )}
                  {shippingCents > 0 && (
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>{t("shipping")}</span>
                      <span>{formatPrice(shippingCents, currency)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-semibold text-sm">
                    <span>{t("total")}</span>
                    <span>{formatPrice(grandTotal, currency)}</span>
                  </div>
                </div>
              );
            })()}

            {/* Free-shipping nudge per seller that's below its threshold. */}
            {shipping.lines.map((l) => {
              if (l.freeThresholdUsd == null || l.shippingUsd === 0) return null;
              const remainingUsd = l.freeThresholdUsd - l.subtotalUsd;
              if (remainingUsd <= 0) return null;
              return (
                <p key={l.orgId} className="text-xs text-emerald-600">
                  {t("freeShippingNudge", {
                    amount: formatPrice(convertCents(remainingUsd, currency, currentRate()), currency),
                    seller: l.orgName,
                  })}
                </p>
              );
            })}
          </CardContent>
        </Card>

        {/* ── Right: payment method + form ───────────────────────── */}
        <div className="space-y-6">

          {/* Payment method toggle */}
          <div className="space-y-2">
            <p className="text-sm font-semibold">{t("paymentMethod")}</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setMethod("card")}
                className={`flex flex-col items-start gap-1 rounded-lg border p-4 text-left transition-colors cursor-pointer
                  ${method === "card"
                    ? "border-foreground bg-foreground/5 ring-1 ring-foreground"
                    : "border-border bg-background dark:bg-input/30 hover:border-foreground/40"
                  }`}
              >
                <CreditCard className="h-5 w-5" />
                <span className="text-sm font-medium">{t("payByCard")}</span>
                <span className="text-xs text-muted-foreground">{t("payByCardDesc")}</span>
              </button>

              <button
                type="button"
                onClick={() => codAvailable && setMethod("cod")}
                disabled={!codAvailable}
                className={`flex flex-col items-start gap-1 rounded-lg border p-4 text-left transition-colors bg-background dark:bg-input/30
                  ${!codAvailable
                    ? "border-border opacity-40 cursor-not-allowed"
                    : method === "cod"
                      ? "border-foreground bg-foreground/5 ring-1 ring-foreground cursor-pointer"
                      : "border-border hover:border-foreground/40 cursor-pointer"
                  }`}
              >
                <Truck className="h-5 w-5" />
                <span className="text-sm font-medium">{t("payOnDelivery")}</span>
                <span className="text-xs text-muted-foreground">
                  {codAvailable ? t("payOnDeliveryDesc") : t("codNotAvailable")}
                </span>
              </button>
            </div>
          </div>

          {/* Card checkout - simple CTA */}
          {method === "card" && (
            <Button
              className="w-full"
              size="lg"
              onClick={handleCardCheckout}
              disabled={isPending || isRedirecting}
            >
              {isPending || isRedirecting ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t("redirectingToStripe")}</>
              ) : (
                <><CreditCard className="mr-2 h-4 w-4" />{t("payByCard")}</>
              )}
            </Button>
          )}

          {/* COD - shipping form */}
          {method === "cod" && (
            <form onSubmit={handleSubmit(handleCodSubmit, onInvalid)} className="space-y-4">
              <p className="text-sm font-semibold">{t("shippingDetails")}</p>

              <div className="space-y-1">
                <Label htmlFor="name">{t("fullName")}</Label>
                <Input id="name" {...register("name")} />
                {errors.name && (
                  <p className="text-xs text-destructive">{errors.name.message}</p>
                )}
              </div>

              <div className="space-y-1">
                <Label htmlFor="line1">{t("addressLine1")}</Label>
                <Input id="line1" {...register("line1")} />
                {errors.line1 && (
                  <p className="text-xs text-destructive">{errors.line1.message}</p>
                )}
              </div>

              <div className="space-y-1">
                <Label htmlFor="line2">{t("addressLine2")}</Label>
                <Input id="line2" {...register("line2")} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="city">{t("city")}</Label>
                  <Input id="city" {...register("city")} />
                  {errors.city && (
                    <p className="text-xs text-destructive">{errors.city.message}</p>
                  )}
                </div>
                <div className="space-y-1">
                  <Label htmlFor="postalCode">{t("postalCode")}</Label>
                  <Input id="postalCode" {...register("postalCode")} />
                  {errors.postalCode && (
                    <p className="text-xs text-destructive">{errors.postalCode.message}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="state">{t("stateRegion")}</Label>
                  <Input id="state" {...register("state")} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="country">{t("country")}</Label>
                  <Input id="country" {...register("country")} />
                  {errors.country && (
                    <p className="text-xs text-destructive">{errors.country.message}</p>
                  )}
                </div>
              </div>

              <Button type="submit" className="w-full" size="lg" disabled={isPending}>
                {isPending ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t("placingOrder")}</>
                ) : (
                  <><Truck className="mr-2 h-4 w-4" />{t("placeOrder")}</>
                )}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}