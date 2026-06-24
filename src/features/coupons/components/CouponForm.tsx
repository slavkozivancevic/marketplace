"use client";

import { useEffect, useMemo, useTransition } from "react";
import { usePathname } from "next/navigation";
import { useForm } from "react-hook-form";
import { useZodResolver } from "@/i18n/useZodResolver";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { DatePicker } from "@/components/ui/date-picker";
import { NumberStepper } from "@/components/ui/number-stepper";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/sonner";
import { useInvalidToast } from "@/lib/forms/useInvalidToast";
import { useCurrencyStore } from "@/store/currency";
import { PriceInput } from "@/features/products/components/PriceInput";
import { couponSchema, type CouponInput } from "../schema/coupons";
import { createCouponAction, updateCouponAction } from "../actions/coupons";

type CouponRow = {
  id: string;
  code: string;
  type: "PERCENT" | "FIXED";
  value: number;
  minOrder: number | null;
  usageLimit: number | null;
  expiresAt: string | null;
  active: boolean;
};

export function CouponForm({ coupon }: { coupon?: CouponRow }) {
  const t = useTranslations("coupons");
  const onInvalid = useInvalidToast();
  const { rates, currency } = useCurrencyStore();
  const [isPending, start] = useTransition();

  // Memoized so RHF's `values` re-sync below only fires when the coupon actually
  // changes, not on every render.
  const derivedValues = useMemo<CouponInput>(
    () =>
      coupon
        ? {
            code: coupon.code,
            type: coupon.type,
            // FIXED value + minOrder are stored in cents; the form works in dollars.
            value: coupon.type === "FIXED" ? coupon.value / 100 : coupon.value,
            minOrder: coupon.minOrder != null ? coupon.minOrder / 100 : null,
            usageLimit: coupon.usageLimit,
            expiresAt: coupon.expiresAt ? coupon.expiresAt.slice(0, 10) : null,
            active: coupon.active,
          }
        : { code: "", type: "PERCENT", value: 10, minOrder: null, usageLimit: null, expiresAt: null, active: true },
    [coupon],
  );

  const pathname = usePathname();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<CouponInput>({
    mode: "onTouched",
    resolver: useZodResolver(couponSchema),
    defaultValues: derivedValues,
  });

  // Next.js can keep this route's React tree warm, so without an explicit reset
  // unsaved edits survive navigating away from the form and back. Resetting to
  // the stored coupon (or blank defaults) on every entry to the route discards
  // them. `pathname` changes on every navigation, so this fires on return; on a
  // genuine remount it simply re-applies the same server values. It can't disrupt
  // active editing because the pathname is stable while the form is on screen.
  useEffect(() => {
    reset(derivedValues);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const type = watch("type");
  const value = watch("value");
  const minOrder = watch("minOrder");
  const usageLimit = watch("usageLimit");
  const expiresAt = watch("expiresAt");
  const active = watch("active");

  const onSubmit = (data: CouponInput) => {
    start(async () => {
      const res = coupon
        ? await updateCouponAction(coupon.id, data)
        : await createCouponAction(data);
      if (res && "error" in res) toast.error(res.message);
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="max-w-lg space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="code">{t("form.code")}</Label>
        <Input id="code" {...register("code")} autoComplete="off" className="uppercase" />
        {errors.code && <p className="text-xs text-destructive">{errors.code.message}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>{t("form.type")}</Label>
          <Select value={type} onValueChange={(v) => setValue("type", v as "PERCENT" | "FIXED")}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="PERCENT">{t("form.percent")}</SelectItem>
              <SelectItem value="FIXED">{t("form.fixed")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="value">{type === "PERCENT" ? t("form.valuePercent") : t("form.valueFixed")}</Label>
          {type === "PERCENT" ? (
            <NumberStepper
              id="value"
              min={0}
              max={100}
              value={Number.isFinite(value) ? value : 0}
              onChange={(v) => setValue("value", v ?? 0, { shouldValidate: true })}
            />
          ) : (
            <PriceInput
              value={Number.isFinite(value) ? value : 0}
              onChange={(usd) => setValue("value", usd, { shouldValidate: true })}
              rates={rates}
              defaultCurrency={currency}
            />
          )}
          {errors.value && <p className="text-xs text-destructive">{errors.value.message}</p>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 items-start">
        <div className="space-y-1.5">
          <Label>{t("form.minOrder")}</Label>
          <PriceInput
            value={minOrder ?? 0}
            onChange={(usd) => setValue("minOrder", usd > 0 ? usd : null)}
            rates={rates}
            defaultCurrency={currency}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="usageLimit">{t("form.usageLimit")}</Label>
          <NumberStepper
            id="usageLimit"
            min={1}
            allowEmpty
            placeholder={t("form.optional")}
            value={usageLimit ?? null}
            onChange={(v) => setValue("usageLimit", v)}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>{t("form.expiresAt")}</Label>
        <DatePicker
          value={expiresAt}
          onChange={(v) => setValue("expiresAt", v)}
          placeholder={t("form.optional")}
          className="max-w-xs"
        />
      </div>

      <div className="flex items-center justify-between rounded-lg border p-4">
        <div className="space-y-0.5">
          <Label htmlFor="coupon-active" className="text-base">{t("form.active")}</Label>
          <p className="text-sm text-muted-foreground">{t("form.activeDesc")}</p>
        </div>
        <Switch id="coupon-active" checked={active} onCheckedChange={(c) => setValue("active", c)} />
      </div>

      <Button type="submit" disabled={isPending}>
        {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        {coupon ? t("form.save") : t("form.create")}
      </Button>
    </form>
  );
}
