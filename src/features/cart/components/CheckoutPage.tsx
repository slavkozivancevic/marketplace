"use client";

import { useState, useTransition } from "react";
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
import { localizedVariantLabel, pickLocalized } from "../utils/variantOptions";
import { useCurrencyStore } from "@/store/currency";
import { formatPrice, convertCents } from "@/lib/currency";
import { createCheckoutSession } from "../actions/checkout";
import { createCodCheckout } from "../actions/codCheckout";
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
  // Read localStorage synchronously at mount to know if items existed before zustand hydrates.
  // This prevents the empty-cart flash when navigating back from Stripe.
  const [hadItemsAtMount] = useState(() => {
    if (typeof window === "undefined") return true;
    try {
      const raw = localStorage.getItem("cart-storage");
      return (JSON.parse(raw ?? "{}").state?.items?.length ?? 0) > 0;
    } catch {
      return true;
    }
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ShippingForm>({
    mode: "onTouched",
    resolver: useZodResolver(shippingSchema),
  });

  if (items.length === 0) {
    if (hadItemsAtMount) return null;
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

  const handleCardCheckout = () => {
    startTransition(async () => {
      const result = await createCheckoutSession(
        items.map((i) => ({
          productId: i.productId,
          variantId: i.variantId,
          quantity: i.quantity,
        })),
      );
      if ("error" in result) {
        toast.error(result.message);
        return;
      }
      // Stripe-hosted checkout - external URL. Bypass next-intl's typed
      // router (it only accepts registered pathnames) with a hard nav.
      window.location.href = result.url;
    });
  };

  const handleCodSubmit = (data: ShippingForm) => {
    startTransition(async () => {
      const result = await createCodCheckout(
        items.map((i) => ({
          productId: i.productId,
          variantId: i.variantId,
          quantity: i.quantity,
        })),
        data,
      );
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
                <div className="flex justify-between text-sm">
                  <div>
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
            <div className="flex justify-between font-semibold text-sm">
              <span>{t("total")}</span>
              <span>{formatPrice(convertCents(totalPrice(), currency, currentRate()), currency)}</span>
            </div>
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
              disabled={isPending}
            >
              {isPending ? (
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