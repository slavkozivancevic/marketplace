"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import { usePathname } from "next/navigation";
import { useForm, useFormState } from "react-hook-form";
import { useZodResolver } from "@/i18n/useZodResolver";
import { z } from "zod/v4";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { CreditCard, Truck, ShoppingBag, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/sonner";
import { useInvalidToast } from "@/lib/forms/useInvalidToast";
import {
  useHasFormErrors,
  useSaveBlockedReason,
} from "@/lib/forms/useSaveBlockedReason";
import { RequiredFieldsNote } from "@/components/forms/RequiredFieldsNote";
import { SaveBlockedNotice } from "@/components/forms/SaveBlockedNotice";
import { useCartStore } from "../store/cartStore";
import { useCartShipping } from "../hooks/useCartShipping";
import { useCartHydrated } from "../hooks/useCartHydrated";
import { CartLineRow } from "./CartLineRow";
import { CartSummary } from "./CartSummary";
import { FreeShippingProgress } from "./FreeShippingProgress";
import { COUPON_STORAGE_KEY } from "../utils/couponStorage";
import { useMoney } from "@/lib/useMoney";
import { createCheckoutSession } from "../actions/checkout";
import { createCodCheckout } from "../actions/codCheckout";
import { validateCouponAction } from "@/features/coupons/actions/validateCoupon";
import { Link } from "@/i18n/navigation";

type PaymentMethod = "card" | "cod";

const shippingSchema = z.object({
  name: z.string().trim().min(2),
  line1: z.string().trim().min(3),
  line2: z.string().optional(),
  city: z.string().trim().min(1),
  state: z.string().optional(),
  postalCode: z.string().trim().min(1),
  country: z.string().trim().min(2),
});

type ShippingForm = z.infer<typeof shippingSchema>;

export function CheckoutPage() {
  const t = useTranslations("checkout");
  const onInvalid = useInvalidToast();
  const router = useRouter();
  const { items } = useCartStore();
  // See CartDrawer: per-line stored amounts, summed - never one conversion of
  // the USD total.
  const { amount: moneyAmount } = useMoney();
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
  // "Store not loaded yet" (show nothing, avoids the empty-cart flash on
  // back-nav from Stripe) versus "cart genuinely empty" - see useCartHydrated.
  const hydrated = useCartHydrated();

  // An applied coupon was validated against a specific cart, and its discount
  // (percentage, min-order eligibility, ...) depends on the subtotal. When the
  // cart changes (e.g. quantities tweaked from the side drawer) re-validate the
  // same code against the new cart and refresh the discount instead of dropping
  // it; only remove it if it's no longer valid (e.g. now below the min order).
  // A ref holds the current code so re-applying doesn't re-trigger this effect.
  const appliedRef = useRef(applied);
  appliedRef.current = applied;
  // The cart AS PRICED: its contents plus the unit price of every line. Both
  // dependents below care about the price, not just the contents - a
  // percentage discount is a function of the subtotal and the free-shipping
  // threshold is judged against it - and prices move under us here, refreshed
  // from the server by this page and by the drawer alike. Keying only on the
  // contents left the drawer able to refresh a price while the delivery beside
  // it stayed computed from the old one. The cost is one extra round trip after
  // a price actually moved; that pass finds nothing to change and settles.
  const cartSig = items
    .map((i) => `${i.productId}:${i.variantId}:${i.quantity}:${i.price}`)
    .join("|");
  useEffect(() => {
    const current = appliedRef.current;
    if (!current) return;
    const refs = items.map((i) => ({ productId: i.productId, variantId: i.variantId, quantity: i.quantity }));
    // Emptying the cart drops the coupon SILENTLY. The buyer just did that
    // themselves, so "your cart is empty" reports their own action back to them
    // as an error, and says nothing about the coupon that actually went - while
    // the page is already switching to its empty-cart state underneath. The
    // toast below is for the cases worth hearing about, like falling under a
    // minimum order, where it explains why the discount disappeared.
    if (refs.length === 0) {
      setApplied(null);
      return;
    }
    let active = true;
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
  }, [cartSig]);

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

  // Per-seller delivery for the current cart, already resolved in the buyer's
  // currency by the server - including whether each seller's free-shipping
  // threshold is met - plus the self-heal that comes with it: the same pass
  // refreshes the persisted price snapshots and prunes lines whose product or
  // variant no longer exists. The drawer and the cart page run the identical
  // hook, so the summary here, the drawer behind it and the eventual charge all
  // describe one and the same cart.
  const shipping = useCartShipping();

  const { register, handleSubmit, control } = useForm<ShippingForm>({
    // Validate on every change so errors surface immediately and `hasErrors`
    // is accurate while the user is still typing (house rule for every form).
    mode: "onChange",
    resolver: useZodResolver(shippingSchema),
  });

  // Read via `useFormState`, not by destructuring `formState` off `useForm`:
  // that is a proxy getter whose values change while the returned object's
  // reference never does, so the React Compiler (`reactCompiler: true`) caches
  // the first read and leaves the per-field errors frozen - checkout validation
  // messages would stick around after the field was corrected.
  const { errors } = useFormState({ control });

  // Block ordering while any shipping field is invalid, with the reason spelled
  // out next to the button. Both go through the hooks rather than reading
  // `errors` directly - see useSaveBlockedReason for why a plain
  // `Object.keys(errors).length` freezes under the React Compiler.
  const hasErrors = useHasFormErrors(control);
  const orderBlockedReason = useSaveBlockedReason(control, "order");

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
            {items.map((item, i) => (
              <div key={`${item.productId}-${item.variantId}`}>
                {i > 0 && <Separator className="mb-3" />}
                {/* Read-only: the cart is settled by the time it reaches this
                    page, and the same row renders it in the drawer and on the
                    cart page with its controls on. */}
                <CartLineRow item={item} editable={false} />
              </div>
            ))}
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

            {/* One breakdown, shared with the drawer and the cart page - the
                three used to be written out separately, which is how the
                drawer ended up showing a bare total. The coupon is this page's
                alone: it is the only place a code can be entered. */}
            <CartSummary
              subtotal={items.reduce(
                (sum, i) => sum + moneyAmount(i.priceMoney) * i.quantity,
                0,
              )}
              discount={applied?.discount ?? 0}
              shippingTotal={shipping.total}
              shippingLines={shipping.lines}
            />

            {/* How far each seller is from free delivery. Same component the
                cart shows, so the buyer sees the goal they were chasing right
                up to the moment they pay. */}
            <FreeShippingProgress lines={shipping.lines} className="space-y-3" />
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
            <form
              noValidate
              onSubmit={handleSubmit(handleCodSubmit, onInvalid)}
              className="space-y-4"
            >
              <p className="text-sm font-semibold">{t("shippingDetails")}</p>
              <RequiredFieldsNote />

              <div className="space-y-1">
                <Label htmlFor="name" required>{t("fullName")}</Label>
                <Input id="name" {...register("name")} aria-invalid={!!errors.name} />
                {errors.name && (
                  <p className="text-xs text-destructive">{errors.name.message}</p>
                )}
              </div>

              <div className="space-y-1">
                <Label htmlFor="line1" required>{t("addressLine1")}</Label>
                <Input id="line1" {...register("line1")} aria-invalid={!!errors.line1} />
                {errors.line1 && (
                  <p className="text-xs text-destructive">{errors.line1.message}</p>
                )}
              </div>

              <div className="space-y-1">
                <Label htmlFor="line2">{t("addressLine2")}</Label>
                <Input id="line2" {...register("line2")} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="city" required>{t("city")}</Label>
                  <Input id="city" {...register("city")} aria-invalid={!!errors.city} />
                  {errors.city && (
                    <p className="text-xs text-destructive">{errors.city.message}</p>
                  )}
                </div>
                <div className="space-y-1">
                  <Label htmlFor="postalCode" required>{t("postalCode")}</Label>
                  <Input id="postalCode" {...register("postalCode")} aria-invalid={!!errors.postalCode} />
                  {errors.postalCode && (
                    <p className="text-xs text-destructive">{errors.postalCode.message}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="state">{t("stateRegion")}</Label>
                  <Input id="state" {...register("state")} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="country" required>{t("country")}</Label>
                  <Input id="country" {...register("country")} aria-invalid={!!errors.country} />
                  {errors.country && (
                    <p className="text-xs text-destructive">{errors.country.message}</p>
                  )}
                </div>
              </div>

              <Button
                type="submit"
                className="w-full"
                size="lg"
                disabled={isPending || hasErrors}
              >
                {isPending ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t("placingOrder")}</>
                ) : (
                  <><Truck className="mr-2 h-4 w-4" />{t("placeOrder")}</>
                )}
              </Button>
              <SaveBlockedNotice blocked={hasErrors} reason={orderBlockedReason} />
            </form>
          )}
        </div>
      </div>
    </div>
  );
}